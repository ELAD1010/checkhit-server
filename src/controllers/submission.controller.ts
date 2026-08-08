import { Response } from "express";
import { getGradingConfig } from "../config/grading.config.js";
import { SubmissionStatus } from "../entities/enums.js";
import { AssignmentRepository } from "../repositories/assignment.repository.js";
import { AssignmentQuestionRepository } from "../repositories/assignment-question.repository.js";
import { EvaluationRepository } from "../repositories/evaluation.repository.js";
import { FileAssetRepository } from "../repositories/file-asset.repository.js";
import {
  StudentNotFoundError,
  SubmissionAlreadySubmittedError,
  SubmissionNotFoundError,
  SubmissionRepository,
} from "../repositories/submission.repository.js";
import type { AuthenticatedRequest } from "../middleware/lti-auth.js";
import type { UploadedFile } from "../middleware/upload.js";
import {
  LocalFileStorage,
  type FileStorage,
} from "../storage/local-file-storage.js";
import {
  assertFileContentMatchesMime,
  detectMimeType,
  UploadValidationError,
} from "../storage/upload-mime.js";
import { isUuid } from "./user-controller.utils.js";

const submissionRepository = new SubmissionRepository();
const assignmentRepository = new AssignmentRepository();
const questionRepository = new AssignmentQuestionRepository();
const evaluationRepository = new EvaluationRepository();
const fileAssetRepository = new FileAssetRepository();
const fileStorage: FileStorage = new LocalFileStorage();

const assertAssignmentInCourse = async (
  assignmentId: string,
  courseId: string,
) => {
  const assignment =
    await assignmentRepository.findAssignmentById(assignmentId);
  if (!assignment || assignment.courseId !== courseId) {
    return null;
  }

  return assignment;
};

const storeUploadedFiles = async (
  files: UploadedFile[] | undefined,
  prefix: string,
  storedAssets: Array<{ id: string; objectKey: string }>,
): Promise<void> => {
  for (const file of files ?? []) {
    const mimeType = detectMimeType(file.originalname);
    if (!mimeType) {
      throw new UploadValidationError("Unsupported file extension");
    }
    assertFileContentMatchesMime(file.buffer, mimeType);
    const stored = await fileStorage.store({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType,
      prefix,
    });
    try {
      const asset = await fileAssetRepository.createFromStoredFile(stored);
      storedAssets.push({ id: asset.id, objectKey: asset.objectKey });
    } catch (error) {
      await fileStorage.delete(stored.objectKey).catch(() => undefined);
      throw error;
    }
  }
};

const cleanupStoredAssets = async (
  assets: Array<{ id: string; objectKey: string }>,
): Promise<void> => {
  await Promise.all(
    assets.map(async (asset) => {
      await fileAssetRepository.deleteById(asset.id).catch(() => undefined);
      await fileStorage.delete(asset.objectKey).catch(() => undefined);
    }),
  );
};

const parseBooleanInput = (value: unknown): boolean =>
  value === true || value === "true" || value === "1";

const maybeCreateEvaluation = async (
  submissionId: string,
  assignmentId: string,
  maxScore: number,
) => {
  const existing =
    await evaluationRepository.findPendingBySubmissionId(submissionId);
  if (existing) {
    return existing;
  }

  const questions = await questionRepository.listByAssignmentId(assignmentId);
  if (questions.length === 0) {
    return null;
  }

  const config = getGradingConfig();
  return evaluationRepository.createPending({
    submissionId,
    questionSetId: questions[0].questionSetId,
    maxScore,
    model: config.geminiModel,
    promptVersion: config.promptVersion,
  });
};

export const createSubmission = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const assignmentId =
    typeof req.params.assignmentId === "string"
      ? req.params.assignmentId
      : undefined;

  if (!assignmentId || !isUuid(assignmentId) || !req.auth) {
    res.status(400).json({ message: "A valid assignment ID is required" });
    return;
  }

  const answerText =
    typeof req.body?.answerText === "string" ? req.body.answerText : null;
  const submit =
    req.body?.submit === true ||
    req.body?.submit === "true" ||
    req.body?.submit === "1";

  let stagedAssets: Array<{ id: string; objectKey: string }> = [];
  let submissionPersisted = false;
  try {
    const assignment = await assertAssignmentInCourse(
      assignmentId,
      req.auth.courseId,
    );
    if (!assignment) {
      res.status(404).json({ message: "Assignment not found" });
      return;
    }

    if (submit) {
      const questions =
        await questionRepository.listByAssignmentId(assignmentId);
      if (questions.length === 0) {
        res.status(400).json({
          message: "Assignment has no questions configured for grading",
        });
        return;
      }
    }

    await storeUploadedFiles(
      (req as AuthenticatedRequest & { files?: UploadedFile[] }).files,
      "submission-files",
      stagedAssets,
    );

    const submission = await submissionRepository.createSubmission({
      assignmentId,
      studentId: req.auth.userId,
      answerText,
      fileIds: stagedAssets.map((asset) => asset.id),
      submit,
    });
    submissionPersisted = true;

    let evaluation = null;
    if (submission.status === SubmissionStatus.SUBMITTED) {
      evaluation = await maybeCreateEvaluation(
        submission.id,
        assignmentId,
        assignment.maxScore,
      );
    }

    res.status(submit ? 202 : 201).json({
      submission,
      evaluation: evaluation
        ? {
            id: evaluation.id,
            status: evaluation.status,
          }
        : null,
    });
  } catch (error) {
    if (!submissionPersisted) {
      await Promise.all(
        stagedAssets.map(async (asset) => {
          await fileAssetRepository.deleteById(asset.id).catch(() => undefined);
          await fileStorage.delete(asset.objectKey).catch(() => undefined);
        }),
      );
    }

    if (error instanceof UploadValidationError) {
      res.status(400).json({ message: error.message });
      return;
    }

    if (error instanceof StudentNotFoundError) {
      res.status(404).json({ message: "Student profile not found" });
      return;
    }

    console.error("Failed to create submission:", error);
    res.status(500).json({ message: "Failed to create submission" });
  }
};

export const submitSubmission = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const submissionId =
    typeof req.params.submissionId === "string"
      ? req.params.submissionId
      : undefined;

  if (!submissionId || !isUuid(submissionId) || !req.auth) {
    res.status(400).json({ message: "A valid submission ID is required" });
    return;
  }

  try {
    const existing = await submissionRepository.findById(submissionId);
    if (!existing || existing.studentId !== req.auth.userId) {
      res.status(404).json({ message: "Submission not found" });
      return;
    }

    if (existing.assignment.courseId !== req.auth.courseId) {
      res.status(404).json({ message: "Submission not found" });
      return;
    }

    const questions = await questionRepository.listByAssignmentId(
      existing.assignmentId,
    );
    if (questions.length === 0) {
      res.status(400).json({
        message: "Assignment has no questions configured for grading",
      });
      return;
    }

    const submission = await submissionRepository.submitDraft(
      submissionId,
      req.auth.userId,
    );
    const evaluation = await maybeCreateEvaluation(
      submission.id,
      existing.assignmentId,
      existing.assignment.maxScore,
    );

    res.status(202).json({
      submission,
      evaluation: evaluation
        ? {
            id: evaluation.id,
            status: evaluation.status,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof SubmissionNotFoundError) {
      res.status(404).json({ message: "Submission not found" });
      return;
    }

    if (error instanceof SubmissionAlreadySubmittedError) {
      res.status(409).json({ message: "Submission already submitted" });
      return;
    }

    console.error("Failed to submit submission:", error);
    res.status(500).json({ message: "Failed to submit submission" });
  }
};

export const updateDraftSubmission = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const submissionId =
    typeof req.params.submissionId === "string"
      ? req.params.submissionId
      : undefined;

  if (!submissionId || !isUuid(submissionId) || !req.auth) {
    res.status(400).json({ message: "A valid submission ID is required" });
    return;
  }

  const hasAnswerText = Object.prototype.hasOwnProperty.call(
    req.body ?? {},
    "answerText",
  );
  const answerText =
    typeof req.body?.answerText === "string" ? req.body.answerText : null;
  const clearFiles = parseBooleanInput(req.body?.clearFiles);
  const uploadedFiles = (
    req as AuthenticatedRequest & { files?: UploadedFile[] }
  ).files;
  const replaceFiles = clearFiles || (uploadedFiles?.length ?? 0) > 0;

  if (!hasAnswerText && !replaceFiles) {
    res.status(400).json({
      message:
        "Nothing to update. Provide answerText and/or files (or clearFiles=true).",
    });
    return;
  }

  let stagedAssets: Array<{ id: string; objectKey: string }> = [];
  try {
    const existing = await submissionRepository.findById(submissionId);
    if (!existing || existing.studentId !== req.auth.userId) {
      res.status(404).json({ message: "Submission not found" });
      return;
    }

    if (existing.assignment.courseId !== req.auth.courseId) {
      res.status(404).json({ message: "Submission not found" });
      return;
    }

    if (existing.status !== SubmissionStatus.DRAFT) {
      res
        .status(409)
        .json({ message: "Only draft submissions can be updated" });
      return;
    }

    if (replaceFiles) {
      await storeUploadedFiles(uploadedFiles, "submission-files", stagedAssets);
    }

    const updated = await submissionRepository.updateDraft(
      submissionId,
      req.auth.userId,
      {
        answerText: hasAnswerText ? answerText : undefined,
        fileIds: replaceFiles
          ? stagedAssets.map((asset) => asset.id)
          : undefined,
      },
    );

    if (replaceFiles) {
      const previousAssets = (existing.files ?? []).map((fileLink) => ({
        id: fileLink.fileId,
        objectKey: fileLink.file.objectKey,
      }));
      await cleanupStoredAssets(previousAssets);
    }

    res.json(updated);
  } catch (error) {
    await cleanupStoredAssets(stagedAssets);

    if (error instanceof UploadValidationError) {
      res.status(400).json({ message: error.message });
      return;
    }

    if (error instanceof SubmissionNotFoundError) {
      res.status(404).json({ message: "Submission not found" });
      return;
    }

    if (error instanceof SubmissionAlreadySubmittedError) {
      res.status(409).json({ message: "Submission already submitted" });
      return;
    }

    console.error("Failed to update draft submission:", error);
    res.status(500).json({ message: "Failed to update draft submission" });
  }
};

export const getSubmission = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const submissionId =
    typeof req.params.submissionId === "string"
      ? req.params.submissionId
      : undefined;

  if (!submissionId || !isUuid(submissionId) || !req.auth) {
    res.status(400).json({ message: "A valid submission ID is required" });
    return;
  }

  try {
    const submission = await submissionRepository.findById(submissionId);
    if (!submission || submission.assignment.courseId !== req.auth.courseId) {
      res.status(404).json({ message: "Submission not found" });
      return;
    }

    if (
      req.auth.role === "STUDENT" &&
      submission.studentId !== req.auth.userId
    ) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    res.json(submission);
  } catch (error) {
    console.error("Failed to fetch submission:", error);
    res.status(500).json({ message: "Failed to fetch submission" });
  }
};

export const listAssignmentSubmissions = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const assignmentId =
    typeof req.params.assignmentId === "string"
      ? req.params.assignmentId
      : undefined;

  if (!assignmentId || !isUuid(assignmentId) || !req.auth) {
    res.status(400).json({ message: "A valid assignment ID is required" });
    return;
  }

  try {
    const assignment = await assertAssignmentInCourse(
      assignmentId,
      req.auth.courseId,
    );
    if (!assignment) {
      res.status(404).json({ message: "Assignment not found" });
      return;
    }

    if (req.auth.role === "STUDENT") {
      const submissions = await submissionRepository.listByAssignmentForStudent(
        assignmentId,
        req.auth.userId,
      );
      res.json(submissions);
      return;
    }

    const submissions =
      await submissionRepository.listByAssignment(assignmentId);
    res.json(submissions);
  } catch (error) {
    console.error("Failed to list submissions:", error);
    res.status(500).json({ message: "Failed to list submissions" });
  }
};
