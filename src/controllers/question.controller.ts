import { Response } from "express";
import { getGradingConfig } from "../config/grading.config.js";
import { QuestionSource } from "../entities/enums.js";
import {
  AssignmentNotFoundError,
  AssignmentQuestionRepository,
  QuestionScoreMismatchError,
} from "../repositories/assignment-question.repository.js";
import { AssignmentRepository } from "../repositories/assignment.repository.js";
import { FileAssetRepository } from "../repositories/file-asset.repository.js";
import { QuestionImportRepository } from "../repositories/question-import.repository.js";
import { isUuid, getDatabaseErrorCode } from "./user-controller.utils.js";
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

const questionRepository = new AssignmentQuestionRepository();
const assignmentRepository = new AssignmentRepository();
const questionImportRepository = new QuestionImportRepository();
const fileAssetRepository = new FileAssetRepository();
const fileStorage: FileStorage = new LocalFileStorage();

type ParsedQuestion = {
  questionKey: string;
  orderIndex: number;
  prompt: string;
  rubric: string | null;
  maxScore: number;
};

const parseQuestionsBody = (body: unknown): ParsedQuestion[] | null => {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const { questions } = body as Record<string, unknown>;
  if (!Array.isArray(questions) || questions.length === 0) {
    return null;
  }

  const parsed: ParsedQuestion[] = [];

  for (const item of questions) {
    if (typeof item !== "object" || item === null) {
      return null;
    }

    const record = item as Record<string, unknown>;
    if (
      typeof record.questionKey !== "string" ||
      record.questionKey.trim() === "" ||
      typeof record.orderIndex !== "number" ||
      !Number.isInteger(record.orderIndex) ||
      record.orderIndex < 0 ||
      typeof record.prompt !== "string" ||
      record.prompt.trim() === "" ||
      typeof record.maxScore !== "number" ||
      !Number.isFinite(record.maxScore) ||
      record.maxScore <= 0 ||
      (record.rubric !== undefined &&
        record.rubric !== null &&
        typeof record.rubric !== "string")
    ) {
      return null;
    }

    parsed.push({
      questionKey: record.questionKey.trim(),
      orderIndex: record.orderIndex,
      prompt: record.prompt.trim(),
      rubric:
        typeof record.rubric === "string" ? record.rubric.trim() || null : null,
      maxScore: record.maxScore,
    });
  }

  return parsed;
};

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

export const listAssignmentQuestions = async (
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

    const questions = await questionRepository.listByAssignmentId(assignmentId);
    res.json(questions);
  } catch (error) {
    console.error("Failed to list assignment questions:", error);
    res.status(500).json({ message: "Failed to list assignment questions" });
  }
};

export const replaceAssignmentQuestions = async (
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

  const questions = parseQuestionsBody(req.body);
  if (!questions) {
    res.status(400).json({
      message:
        "Invalid questions payload. Provide a non-empty questions array with questionKey, orderIndex, prompt, and maxScore",
    });
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

    const saved = await questionRepository.replaceQuestions(
      assignmentId,
      questions.map((question) => ({
        ...question,
        source: QuestionSource.MANUAL,
        importId: null,
      })),
    );
    res.status(200).json(saved);
  } catch (error) {
    if (error instanceof AssignmentNotFoundError) {
      res.status(404).json({ message: "Assignment not found" });
      return;
    }

    if (error instanceof QuestionScoreMismatchError) {
      res.status(400).json({ message: error.message });
      return;
    }

    if (getDatabaseErrorCode(error) === "23505") {
      res.status(400).json({
        message: "Question keys and order indexes must be unique",
      });
      return;
    }

    console.error("Failed to replace assignment questions:", error);
    res.status(500).json({ message: "Failed to replace assignment questions" });
  }
};

export const importAssignmentQuestionsFromDocument = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const assignmentId =
    typeof req.params.assignmentId === "string"
      ? req.params.assignmentId
      : undefined;
  const file = (req as AuthenticatedRequest & { file?: UploadedFile }).file;

  if (!assignmentId || !isUuid(assignmentId) || !req.auth) {
    res.status(400).json({ message: "A valid assignment ID is required" });
    return;
  }

  if (!file) {
    res.status(400).json({ message: "A document file is required" });
    return;
  }

  let stagedFile: { id: string; objectKey: string } | null = null;
  let stagedObjectKey: string | null = null;
  let importPersisted = false;
  try {
    const assignment = await assertAssignmentInCourse(
      assignmentId,
      req.auth.courseId,
    );
    if (!assignment) {
      res.status(404).json({ message: "Assignment not found" });
      return;
    }

    const mimeType = detectMimeType(file.originalname);
    if (!mimeType) {
      throw new UploadValidationError("Unsupported file extension");
    }
    assertFileContentMatchesMime(file.buffer, mimeType);
    const stored = await fileStorage.store({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType,
      prefix: "assignment-imports",
    });
    stagedObjectKey = stored.objectKey;
    const fileAsset = await fileAssetRepository.createFromStoredFile(stored);
    stagedFile = { id: fileAsset.id, objectKey: fileAsset.objectKey };
    const config = getGradingConfig();
    const questionImport = await questionImportRepository.createImport({
      assignmentId,
      fileId: fileAsset.id,
      model: config.geminiModel,
      promptVersion: config.questionImportPromptVersion,
    });
    importPersisted = true;

    res.status(202).json({
      importId: questionImport.id,
      status: questionImport.status,
      assignmentId,
      fileId: fileAsset.id,
    });
  } catch (error) {
    if (stagedFile && !importPersisted) {
      await fileAssetRepository.deleteById(stagedFile.id).catch(() => undefined);
      await fileStorage.delete(stagedFile.objectKey).catch(() => undefined);
    } else if (stagedObjectKey && !importPersisted) {
      await fileStorage.delete(stagedObjectKey).catch(() => undefined);
    }

    if (error instanceof UploadValidationError) {
      res.status(400).json({ message: error.message });
      return;
    }

    console.error("Failed to start question import:", error);
    res.status(500).json({ message: "Failed to start question import" });
  }
};

export const getQuestionImportStatus = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const importId =
    typeof req.params.importId === "string" ? req.params.importId : undefined;

  if (!importId || !isUuid(importId) || !req.auth) {
    res.status(400).json({ message: "A valid import ID is required" });
    return;
  }

  try {
    const questionImport = await questionImportRepository.findById(importId);
    if (
      !questionImport ||
      questionImport.assignment.courseId !== req.auth.courseId
    ) {
      res.status(404).json({ message: "Question import not found" });
      return;
    }

    res.json({
      id: questionImport.id,
      assignmentId: questionImport.assignmentId,
      status: questionImport.status,
      errorMessage:
        questionImport.status === "FAILED"
          ? "Question import failed after all retry attempts"
          : null,
      attemptCount: questionImport.attemptCount,
      maxAttempts: questionImport.maxAttempts,
      questions: questionImport.questions ?? [],
      createdAt: questionImport.createdAt,
      updatedAt: questionImport.updatedAt,
      completedAt: questionImport.completedAt,
    });
  } catch (error) {
    console.error("Failed to fetch question import:", error);
    res.status(500).json({ message: "Failed to fetch question import" });
  }
};
