import { Response } from "express";
import type { Appeal } from "../entities/appeal.js";
import { AppealStatus, UserRole } from "../entities/enums.js";
import type { AuthenticatedRequest } from "../middleware/lti-auth.js";
import type { UploadedFile } from "../middleware/upload.js";
import {
  APPEAL_CATEGORIES,
  AppealConflictError,
  AppealForbiddenError,
  AppealLecturerNotFoundError,
  AppealNotFoundError,
  AppealRepository,
  AppealStudentNotFoundError,
  AppealValidationError,
  type AppealCategory,
} from "../repositories/appeal.repository.js";
import { FileAssetRepository } from "../repositories/file-asset.repository.js";
import { AppealAiService } from "../services/appeal-ai.service.js";
import { notificationService } from "../services/notification.service.js";
import { LocalFileStorage, type FileStorage } from "../storage/local-file-storage.js";
import {
  assertFileContentMatchesMime,
  detectMimeType,
  UploadValidationError,
} from "../storage/upload-mime.js";
import { getDatabaseErrorCode, isUuid } from "./user-controller.utils.js";

const appealRepository = new AppealRepository();
const appealAiService = new AppealAiService();
const fileAssetRepository = new FileAssetRepository();
const fileStorage: FileStorage = new LocalFileStorage();

const serializeAppeal = (appeal: Appeal) => ({
  ...appeal,
  files: (appeal.files ?? []).map(({ file }) => ({
    id: file.id,
    fileId: file.id,
    name: file.originalName,
    mimeType: file.mimeType,
    sizeBytes: Number(file.sizeBytes),
    downloadUrl: `/api/appeals/${appeal.id}/evidence/${file.id}`,
  })),
});

const sendAppealError = (error: unknown, res: Response): boolean => {
  if (error instanceof AppealValidationError || error instanceof UploadValidationError) {
    res.status(400).json({ message: error.message });
    return true;
  }
  if (error instanceof AppealForbiddenError) {
    res.status(403).json({ message: error.message });
    return true;
  }
  if (
    error instanceof AppealNotFoundError ||
    error instanceof AppealStudentNotFoundError ||
    error instanceof AppealLecturerNotFoundError
  ) {
    res.status(404).json({ message: error.message });
    return true;
  }
  if (error instanceof AppealConflictError || getDatabaseErrorCode(error) === "23505") {
    res.status(409).json({
      message: error instanceof Error ? error.message : "An appeal already exists for this submission",
    });
    return true;
  }
  return false;
};

const canReadAppeal = async (
  appeal: Appeal,
  req: AuthenticatedRequest,
): Promise<boolean> => {
  if (!req.auth) return false;
  if (req.auth.role === UserRole.STUDENT) return appeal.studentId === req.auth.userId;
  return appealRepository.isLecturerForCourse(
    req.auth.userId,
    appeal.submission.assignment.courseId,
  );
};

const storeEvidenceFiles = async (
  files: UploadedFile[] | undefined,
): Promise<Array<{ id: string; objectKey: string }>> => {
  const storedAssets: Array<{ id: string; objectKey: string }> = [];
  try {
    for (const file of files ?? []) {
      const mimeType = detectMimeType(file.originalname);
      if (!mimeType) {
        throw new UploadValidationError("Unsupported evidence file type");
      }
      assertFileContentMatchesMime(file.buffer, mimeType);
      const stored = await fileStorage.store({
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType,
        prefix: "appeal-evidence",
      });
      try {
        const asset = await fileAssetRepository.createFromStoredFile(stored);
        storedAssets.push({ id: asset.id, objectKey: asset.objectKey });
      } catch (error) {
        await fileStorage.delete(stored.objectKey).catch(() => undefined);
        throw error;
      }
    }
    return storedAssets;
  } catch (error) {
    await Promise.all(
      storedAssets.map(async (asset) => {
        await fileAssetRepository.deleteById(asset.id).catch(() => undefined);
        await fileStorage.delete(asset.objectKey).catch(() => undefined);
      }),
    );
    throw error;
  }
};

const cleanupAssets = async (
  assets: Array<{ id: string; objectKey: string }>,
): Promise<void> => {
  await Promise.all(
    assets.map(async (asset) => {
      await fileAssetRepository.deleteById(asset.id).catch(() => undefined);
      await fileStorage.delete(asset.objectKey).catch(() => undefined);
    }),
  );
};

export const createAppeal = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  if (!req.auth) {
    res.status(401).json({ message: "Missing LTI session" });
    return;
  }
  const submissionId =
    typeof req.body?.submissionId === "string" ? req.body.submissionId.trim() : "";
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  const category =
    typeof req.body?.category === "string" && req.body.category.trim()
      ? req.body.category.trim()
      : undefined;
  const file = (req as AuthenticatedRequest & { file?: UploadedFile }).file;

  if (!isUuid(submissionId)) {
    res.status(400).json({ message: "A valid submissionId is required" });
    return;
  }
  if (reason.length < 20 || reason.length > 5000) {
    res.status(400).json({ message: "reason must contain between 20 and 5000 characters" });
    return;
  }
  if (category && !APPEAL_CATEGORIES.includes(category as AppealCategory)) {
    res.status(400).json({ message: "Invalid appeal category" });
    return;
  }

  let stagedAsset: { id: string; objectKey: string } | undefined;
  try {
    if (file) {
      const mimeType = detectMimeType(file.originalname);
      if (mimeType !== "application/pdf") {
        throw new UploadValidationError("Only PDF evidence files are supported");
      }
      assertFileContentMatchesMime(file.buffer, mimeType);
      const stored = await fileStorage.store({
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType,
        prefix: "appeals",
      });
      try {
        const asset = await fileAssetRepository.createFromStoredFile(stored);
        stagedAsset = { id: asset.id, objectKey: asset.objectKey };
      } catch (error) {
        await fileStorage.delete(stored.objectKey).catch(() => undefined);
        throw error;
      }
    }

    const appeal = await appealRepository.createAppeal({
      submissionId,
      studentId: req.auth.userId,
      reason,
      category: category as AppealCategory | undefined,
      fileIds: stagedAsset ? [stagedAsset.id] : [],
    });
    stagedAsset = undefined;
    await notificationService.safely("appeal submitted", () =>
      notificationService.notifyAppeal(appeal.id),
    );
    res.status(201).json(serializeAppeal(appeal));
  } catch (error) {
    if (stagedAsset) {
      await fileAssetRepository.deleteById(stagedAsset.id).catch(() => undefined);
      await fileStorage.delete(stagedAsset.objectKey).catch(() => undefined);
    }
    if (!sendAppealError(error, res)) {
      console.error("Failed to create appeal:", error);
      res.status(500).json({ message: "Failed to create appeal" });
    }
  }
};

export const getStudentAppeals = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const studentId = typeof req.params.studentId === "string" ? req.params.studentId : "";
  if (!req.auth || !isUuid(studentId)) {
    res.status(req.auth ? 400 : 401).json({
      message: req.auth ? "A valid student ID is required" : "Missing LTI session",
    });
    return;
  }
  if (studentId !== req.auth.userId) {
    res.status(403).json({ message: "Students may only read their own appeals" });
    return;
  }
  const limit =
    typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : undefined;
  try {
    const appeals = await appealRepository.findAppealsByStudentId(studentId, {
      limit: limit && Number.isFinite(limit) ? limit : undefined,
      status: typeof req.query.status === "string" ? req.query.status : undefined,
    });
    res.json(appeals.map(serializeAppeal));
  } catch (error) {
    if (!sendAppealError(error, res)) {
      console.error("Failed to fetch student appeals:", error);
      res.status(500).json({ message: "Failed to fetch student appeals" });
    }
  }
};

export const getLecturerAppeals = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const lecturerId = typeof req.params.lecturerId === "string" ? req.params.lecturerId : "";
  if (!req.auth || !isUuid(lecturerId)) {
    res.status(req.auth ? 400 : 401).json({
      message: req.auth ? "A valid lecturer ID is required" : "Missing LTI session",
    });
    return;
  }
  if (lecturerId !== req.auth.userId) {
    res.status(403).json({ message: "Lecturers may only read their own course appeals" });
    return;
  }
  const courseId = typeof req.query.courseId === "string" ? req.query.courseId : undefined;
  if (courseId && !isUuid(courseId)) {
    res.status(400).json({ message: "Invalid course ID format" });
    return;
  }
  const limit =
    typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : undefined;
  try {
    const appeals = await appealRepository.findAppealsByLecturerId(lecturerId, {
      limit: limit && Number.isFinite(limit) ? limit : undefined,
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      courseId,
      search: typeof req.query.search === "string" ? req.query.search : undefined,
    });
    res.json(appeals.map(serializeAppeal));
  } catch (error) {
    if (!sendAppealError(error, res)) {
      console.error("Failed to fetch lecturer appeals:", error);
      res.status(500).json({ message: "Failed to fetch lecturer appeals" });
    }
  }
};

export const getLecturerAppealsStats = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const lecturerId = typeof req.params.lecturerId === "string" ? req.params.lecturerId : "";
  if (!req.auth || !isUuid(lecturerId)) {
    res.status(req.auth ? 400 : 401).json({ message: "A valid lecturer ID is required" });
    return;
  }
  if (lecturerId !== req.auth.userId) {
    res.status(403).json({ message: "Lecturers may only read their own appeal stats" });
    return;
  }
  try {
    res.json(await appealRepository.getLecturerAppealsStats(lecturerId));
  } catch (error) {
    if (!sendAppealError(error, res)) {
      console.error("Failed to fetch lecturer appeal stats:", error);
      res.status(500).json({ message: "Failed to fetch lecturer appeal stats" });
    }
  }
};

export const getAppealById = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const appealId = typeof req.params.appealId === "string" ? req.params.appealId : "";
  if (!req.auth || !isUuid(appealId)) {
    res.status(req.auth ? 400 : 401).json({ message: "A valid appeal ID is required" });
    return;
  }
  try {
    const appeal = await appealRepository.findAppealById(appealId);
    if (!appeal) throw new AppealNotFoundError(appealId);
    if (!(await canReadAppeal(appeal, req))) throw new AppealForbiddenError();
    res.json(serializeAppeal(appeal));
  } catch (error) {
    if (!sendAppealError(error, res)) {
      console.error("Failed to fetch appeal:", error);
      res.status(500).json({ message: "Failed to fetch appeal" });
    }
  }
};

export const claimAppeal = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const appealId = typeof req.params.appealId === "string" ? req.params.appealId : "";
  if (!req.auth || !isUuid(appealId)) {
    res.status(req.auth ? 400 : 401).json({ message: "A valid appeal ID is required" });
    return;
  }
  try {
    const appeal = await appealRepository.claimAppeal(
      appealId,
      req.auth.userId,
    );
    await notificationService.safely("appeal claimed", () =>
      notificationService.notifyAppeal(appeal.id),
    );
    res.json(serializeAppeal(appeal));
  } catch (error) {
    if (!sendAppealError(error, res)) {
      console.error("Failed to claim appeal:", error);
      res.status(500).json({ message: "Failed to claim appeal" });
    }
  }
};

export const cancelAppeal = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const appealId =
    typeof req.params.appealId === "string" ? req.params.appealId : "";
  if (!req.auth || !isUuid(appealId)) {
    res.status(req.auth ? 400 : 401).json({
      message: req.auth ? "A valid appeal ID is required" : "Missing LTI session",
    });
    return;
  }
  try {
    const appeal = await appealRepository.cancelAppeal(
      appealId,
      req.auth.userId,
    );
    await notificationService.safely("appeal cancelled", () =>
      notificationService.notifyAppeal(appeal.id),
    );
    res.json(serializeAppeal(appeal));
  } catch (error) {
    if (!sendAppealError(error, res)) {
      console.error("Failed to cancel appeal:", error);
      res.status(500).json({ message: "Failed to cancel appeal" });
    }
  }
};

export const addAppealEvidence = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const appealId =
    typeof req.params.appealId === "string" ? req.params.appealId : "";
  if (!req.auth || !isUuid(appealId)) {
    res.status(req.auth ? 400 : 401).json({
      message: req.auth ? "A valid appeal ID is required" : "Missing LTI session",
    });
    return;
  }

  let staged: Array<{ id: string; objectKey: string }> = [];
  try {
    staged = await storeEvidenceFiles(
      (req as AuthenticatedRequest & { files?: UploadedFile[] }).files,
    );
    if (staged.length === 0) {
      throw new AppealValidationError(
        "At least one evidence file is required",
      );
    }
    const appeal = await appealRepository.addEvidence(
      appealId,
      req.auth.userId,
      staged.map((asset) => asset.id),
    );
    staged = [];
    res.json(serializeAppeal(appeal));
  } catch (error) {
    await cleanupAssets(staged);
    if (!sendAppealError(error, res)) {
      console.error("Failed to add appeal evidence:", error);
      res.status(500).json({ message: "Failed to add appeal evidence" });
    }
  }
};

export const removeAppealEvidence = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const appealId =
    typeof req.params.appealId === "string" ? req.params.appealId : "";
  const fileId =
    typeof req.params.fileId === "string" ? req.params.fileId : "";
  if (!req.auth || !isUuid(appealId) || !isUuid(fileId)) {
    res.status(req.auth ? 400 : 401).json({
      message: req.auth
        ? "Valid appeal and file IDs are required"
        : "Missing LTI session",
    });
    return;
  }
  try {
    const appeal = await appealRepository.removeEvidence(
      appealId,
      req.auth.userId,
      fileId,
    );
    res.json(serializeAppeal(appeal));
  } catch (error) {
    if (!sendAppealError(error, res)) {
      console.error("Failed to remove appeal evidence:", error);
      res.status(500).json({ message: "Failed to remove appeal evidence" });
    }
  }
};

export const reviewAppealWithAi = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const appealId =
    typeof req.params.appealId === "string" ? req.params.appealId : "";
  if (!req.auth || !isUuid(appealId)) {
    res.status(req.auth ? 400 : 401).json({
      message: req.auth ? "A valid appeal ID is required" : "Missing LTI session",
    });
    return;
  }
  const autoResolve =
    req.body?.autoResolve === true || req.body?.autoResolve === "true";
  try {
    const appeal = await appealAiService.review({
      appealId,
      lecturerId: req.auth.userId,
      autoResolve,
    });
    await notificationService.safely("AI appeal review", () =>
      notificationService.notifyAppeal(appeal.id),
    );
    if (autoResolve && appeal.resultEvaluationId) {
      await notificationService.safely("AI appeal grade", () =>
        notificationService.notifyEvaluationCompleted(
          appeal.resultEvaluationId!,
        ),
      );
    }
    res.json(serializeAppeal(appeal));
  } catch (error) {
    if (!sendAppealError(error, res)) {
      console.error("Failed to review appeal with AI:", error);
      res.status(502).json({ message: "AI appeal review failed" });
    }
  }
};

export const resolveAppeal = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const appealId = typeof req.params.appealId === "string" ? req.params.appealId : "";
  if (!req.auth || !isUuid(appealId)) {
    res.status(req.auth ? 400 : 401).json({ message: "A valid appeal ID is required" });
    return;
  }
  const status = req.body?.status;
  const resolution = typeof req.body?.resolution === "string" ? req.body.resolution.trim() : "";
  if (status !== AppealStatus.ACCEPTED && status !== AppealStatus.REJECTED) {
    res.status(400).json({ message: "status must be ACCEPTED or REJECTED" });
    return;
  }
  if (!resolution || resolution.length > 5000) {
    res.status(400).json({ message: "A resolution of at most 5000 characters is required" });
    return;
  }
  const newScore =
    req.body?.newScore === undefined || req.body?.newScore === null || req.body?.newScore === ""
      ? undefined
      : Number(req.body.newScore);
  if (newScore !== undefined && !Number.isFinite(newScore)) {
    res.status(400).json({ message: "newScore must be a number" });
    return;
  }
  try {
    const appeal = await appealRepository.resolveAppeal(appealId, {
      status,
      resolution,
      reviewerId: req.auth.userId,
      newScore,
    });
    await notificationService.safely("appeal resolved", () =>
      notificationService.notifyAppeal(appeal.id),
    );
    if (appeal.resultEvaluationId) {
      await notificationService.safely("appeal grade", () =>
        notificationService.notifyEvaluationCompleted(
          appeal.resultEvaluationId!,
        ),
      );
    }
    res.json(serializeAppeal(appeal));
  } catch (error) {
    if (!sendAppealError(error, res)) {
      console.error("Failed to resolve appeal:", error);
      res.status(500).json({ message: "Failed to resolve appeal" });
    }
  }
};

export const downloadAppealEvidence = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const appealId = typeof req.params.appealId === "string" ? req.params.appealId : "";
  const fileId = typeof req.params.fileId === "string" ? req.params.fileId : "";
  if (!req.auth || !isUuid(appealId) || !isUuid(fileId)) {
    res.status(req.auth ? 400 : 401).json({ message: "Valid appeal and file IDs are required" });
    return;
  }
  try {
    const appeal = await appealRepository.findAppealById(appealId);
    if (!appeal) throw new AppealNotFoundError(appealId);
    if (!(await canReadAppeal(appeal, req))) throw new AppealForbiddenError();
    const evidence = await appealRepository.findEvidence(appealId, fileId);
    if (!evidence) {
      res.status(404).json({ message: "Evidence file not found" });
      return;
    }
    const buffer = await fileStorage.read(evidence.file.objectKey);
    res.setHeader("Content-Type", evidence.file.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(evidence.file.originalName)}`,
    );
    res.send(buffer);
  } catch (error) {
    if (!sendAppealError(error, res)) {
      console.error("Failed to download appeal evidence:", error);
      res.status(500).json({ message: "Failed to download evidence" });
    }
  }
};
