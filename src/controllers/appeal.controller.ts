import { Request, Response } from "express";
import { AppealStatus, UserRole } from "../entities/enums.js";
import type { Appeal } from "../entities/appeal.js";
import {
  AppealConflictError,
  AppealForbiddenError,
  AppealLecturerNotFoundError,
  AppealNotFoundError,
  AppealRepository,
  AppealStudentNotFoundError,
  AppealValidationError,
} from "../repositories/appeal.repository.js";
import { isUuid } from "./user-controller.utils.js";
import { notificationService } from "../services/notification.service.js";
import type { AuthenticatedRequest } from "../middleware/lti-auth.js";
import type { UploadedFile } from "../middleware/upload.js";
import { FileAssetRepository } from "../repositories/file-asset.repository.js";
import { Submission } from "../entities/submission.js";
import { CourseLecturer } from "../entities/course-lecturer.js";
import { AppDataSource } from "../database/data-source.js";
import { AppealAiService } from "../services/appeal-ai.service.js";
import { LocalFileStorage } from "../storage/local-file-storage.js";
import {
  assertFileContentMatchesMime,
  detectMimeType,
  UploadValidationError,
} from "../storage/upload-mime.js";

const appealRepository = new AppealRepository();
const appealAiService = new AppealAiService();
const fileAssetRepository = new FileAssetRepository();
const fileStorage = new LocalFileStorage();
const APPEAL_CATEGORIES = new Set([
  "grading_error",
  "misunderstanding",
  "technical",
  "other",
]);

const appealResponse = (appeal: Appeal) => ({
  ...appeal,
  files: (appeal.files ?? []).map((link) => ({
    ...link,
    id: link.fileId,
    name: link.file?.originalName,
    filename: link.file?.originalName,
    sizeBytes: link.file ? Number(link.file.sizeBytes) : undefined,
    fileSize: link.file ? Number(link.file.sizeBytes) : undefined,
    downloadUrl: `/api/appeals/${appeal.id}/evidence/${link.fileId}`,
    fileUrl: `/api/appeals/${appeal.id}/evidence/${link.fileId}`,
  })),
});

const canReadAppeal = async (
  req: AuthenticatedRequest,
  appeal: Appeal,
): Promise<boolean> => {
  if (!req.auth) return true;
  if (req.auth.role === UserRole.STUDENT) {
    return appeal.studentId === req.auth.userId;
  }
  return AppDataSource.getRepository(CourseLecturer).existsBy({
    courseId: appeal.submission.assignment.courseId,
    lecturerId: req.auth.userId,
  });
};

const actorId = (
  req: AuthenticatedRequest,
  res: Response,
  bodyField: "studentId" | "reviewerId",
): string | undefined => {
  const header = req.headers["x-user-id"];
  const candidates = [
    req.auth?.userId,
    res.locals.token?.user,
    typeof header === "string" ? header : undefined,
    typeof req.body?.[bodyField] === "string" ? req.body[bodyField] : undefined,
  ];
  return candidates.find((value) => typeof value === "string" && isUuid(value));
};

const parseFileIds = (value: unknown): string[] | null => {
  let candidate = value;
  if (typeof value === "string") {
    try {
      candidate = JSON.parse(value);
    } catch {
      candidate = value.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }
  if (candidate === undefined || candidate === null || candidate === "") return [];
  if (!Array.isArray(candidate) || candidate.some((id) => typeof id !== "string" || !isUuid(id))) {
    return null;
  }
  return [...new Set(candidate as string[])];
};

const storeEvidenceFiles = async (
  files: UploadedFile[] | undefined,
): Promise<Array<{ id: string; objectKey: string }>> => {
  const storedAssets: Array<{ id: string; objectKey: string }> = [];
  try {
    for (const file of files ?? []) {
      const mimeType = detectMimeType(file.originalname);
      if (!mimeType) throw new UploadValidationError("Unsupported evidence file type");
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

const sendAppealError = (res: Response, error: unknown): boolean => {
  if (
    error instanceof AppealValidationError ||
    error instanceof UploadValidationError
  ) {
    res.status(400).json({ message: error.message });
    return true;
  }
  if (error instanceof AppealForbiddenError) {
    res.status(403).json({ message: error.message });
    return true;
  }
  if (error instanceof AppealNotFoundError) {
    res.status(404).json({ message: error.message });
    return true;
  }
  if (error instanceof AppealConflictError) {
    res.status(409).json({ message: error.message });
    return true;
  }
  if (
    error instanceof AppealLecturerNotFoundError ||
    error instanceof AppealStudentNotFoundError
  ) {
    res.status(404).json({ message: error.message });
    return true;
  }
  return false;
};

export const createAppeal = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const submissionId = typeof req.body?.submissionId === "string"
    ? req.body.submissionId
    : undefined;
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  const category = typeof req.body?.category === "string"
    ? req.body.category.trim().slice(0, 50) || null
    : null;
  const fileIds = parseFileIds(req.body?.fileIds);
  if (
    !submissionId ||
    !isUuid(submissionId) ||
    reason.length < 20 ||
    reason.length > 5000 ||
    !fileIds ||
    (category !== null && !APPEAL_CATEGORIES.has(category))
  ) {
    res.status(400).json({
      message: "Provide a valid submissionId, a 20-5000 character reason, a supported category, and valid fileIds",
    });
    return;
  }

  let studentId = actorId(req, res, "studentId");
  if (!studentId) {
    studentId = (await AppDataSource.getRepository(Submission).findOne({
      where: { id: submissionId },
      select: { studentId: true },
    }))?.studentId;
  }
  if (!studentId) {
    res.status(401).json({ message: "Student identity is required" });
    return;
  }

  let staged: Array<{ id: string; objectKey: string }> = [];
  try {
    staged = await storeEvidenceFiles(
      (req as AuthenticatedRequest & { files?: UploadedFile[] }).files,
    );
    const appeal = await appealRepository.createAppeal({
      submissionId,
      studentId,
      reason,
      category,
      fileIds: [...fileIds, ...staged.map((asset) => asset.id)],
    });
    await notificationService.safely("appeal submitted", () =>
      notificationService.notifyAppeal(appeal.id),
    );
    res.status(201).json(appealResponse(appeal));
  } catch (error) {
    await cleanupAssets(staged);
    if (sendAppealError(res, error)) return;
    console.error("Failed to create appeal:", error);
    res.status(500).json({ message: "Failed to create appeal" });
  }
};

export const getStudentAppeals = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const studentId =
    typeof req.params.studentId === "string" ? req.params.studentId : undefined;

  if (!studentId || !isUuid(studentId)) {
    res.status(400).json({ message: "A valid student ID is required" });
    return;
  }
  const auth = (req as AuthenticatedRequest).auth;
  if (auth && (auth.role !== UserRole.STUDENT || auth.userId !== studentId)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const limit = req.query.limit
    ? parseInt(req.query.limit as string, 10)
    : undefined;
  const status =
    typeof req.query.status === "string" ? req.query.status : undefined;

  try {
    const appeals = await appealRepository.findAppealsByStudentId(studentId, {
      limit: limit && !isNaN(limit) ? limit : undefined,
      status,
    });
    res.json(appeals.map(appealResponse));
  } catch (error) {
    if (error instanceof AppealStudentNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    console.error("Failed to fetch student appeals:", error);
    res.status(500).json({ message: "Failed to fetch student appeals" });
  }
};

export const getLecturerAppeals = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const tokenUserId = res.locals.token?.user;
  const lecturerId =
    (typeof req.params.lecturerId === "string" && req.params.lecturerId) ||
    (typeof req.query.lecturerId === "string" && req.query.lecturerId) ||
    (typeof tokenUserId === "string" && tokenUserId ? tokenUserId : undefined);

  if (!lecturerId || !isUuid(lecturerId)) {
    res.status(400).json({ message: "A valid lecturer ID is required" });
    return;
  }
  const auth = (req as AuthenticatedRequest).auth;
  if (
    auth &&
    (auth.role !== UserRole.LECTURER || auth.userId !== lecturerId)
  ) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const limit = req.query.limit
    ? parseInt(req.query.limit as string, 10)
    : undefined;
  const status =
    typeof req.query.status === "string" ? req.query.status : undefined;
  const courseId =
    typeof req.query.courseId === "string" ? req.query.courseId : undefined;
  const search =
    typeof req.query.search === "string" ? req.query.search : undefined;

  if (courseId && !isUuid(courseId)) {
    res.status(400).json({ message: "Invalid course ID format" });
    return;
  }

  try {
    const appeals = await appealRepository.findAppealsByLecturerId(lecturerId, {
      limit: limit && !isNaN(limit) ? limit : undefined,
      status,
      courseId,
      search,
    });
    res.json(appeals.map(appealResponse));
  } catch (error) {
    if (error instanceof AppealLecturerNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    console.error("Failed to fetch lecturer appeals:", error);
    res.status(500).json({ message: "Failed to fetch lecturer appeals" });
  }
};

export const getLecturerAppealsStats = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const tokenUserId = res.locals.token?.user;
  const lecturerId =
    (typeof req.params.lecturerId === "string" && req.params.lecturerId) ||
    (typeof req.query.lecturerId === "string" && req.query.lecturerId) ||
    (typeof tokenUserId === "string" && tokenUserId ? tokenUserId : undefined);

  if (!lecturerId || !isUuid(lecturerId)) {
    res.status(400).json({ message: "A valid lecturer ID is required" });
    return;
  }
  const auth = (req as AuthenticatedRequest).auth;
  if (
    auth &&
    (auth.role !== UserRole.LECTURER || auth.userId !== lecturerId)
  ) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  try {
    const stats = await appealRepository.getLecturerAppealsStats(lecturerId);
    res.json(stats);
  } catch (error) {
    if (error instanceof AppealLecturerNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    console.error("Failed to fetch lecturer appeals stats:", error);
    res.status(500).json({ message: "Failed to fetch lecturer appeals stats" });
  }
};

export const getAppealById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const appealId =
    typeof req.params.appealId === "string" ? req.params.appealId : undefined;

  if (!appealId || !isUuid(appealId)) {
    res.status(400).json({ message: "A valid appeal ID is required" });
    return;
  }

  try {
    const appeal = await appealRepository.findAppealById(appealId);

    if (!appeal) {
      res.status(404).json({ message: "Appeal not found" });
      return;
    }

    if (!(await canReadAppeal(req as AuthenticatedRequest, appeal))) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    res.json(appealResponse(appeal));
  } catch (error) {
    console.error("Failed to fetch appeal by ID:", error);
    res.status(500).json({ message: "Failed to fetch appeal" });
  }
};

export const claimAppeal = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const appealId = typeof req.params.appealId === "string"
    ? req.params.appealId
    : undefined;
  const lecturerId = actorId(req, res, "reviewerId");
  if (!appealId || !isUuid(appealId) || !lecturerId) {
    res.status(400).json({ message: "Valid appealId and reviewerId are required" });
    return;
  }
  try {
    const appeal = await appealRepository.claimAppeal(appealId, lecturerId);
    await notificationService.safely("appeal claimed", () =>
      notificationService.notifyAppeal(appeal.id),
    );
    res.json(appealResponse(appeal));
  } catch (error) {
    if (sendAppealError(res, error)) return;
    console.error("Failed to claim appeal:", error);
    res.status(500).json({ message: "Failed to claim appeal" });
  }
};

export const cancelAppeal = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const appealId = typeof req.params.appealId === "string"
    ? req.params.appealId
    : undefined;
  if (!appealId || !isUuid(appealId)) {
    res.status(400).json({ message: "A valid appeal ID is required" });
    return;
  }
  try {
    const existing = await appealRepository.findAppealById(appealId);
    if (!existing) throw new AppealNotFoundError(appealId);
    const studentId = actorId(req, res, "studentId") ?? existing.studentId;
    const appeal = await appealRepository.cancelAppeal(appealId, studentId);
    await notificationService.safely("appeal cancelled", () =>
      notificationService.notifyAppeal(appeal.id),
    );
    res.json(appealResponse(appeal));
  } catch (error) {
    if (sendAppealError(res, error)) return;
    console.error("Failed to cancel appeal:", error);
    res.status(500).json({ message: "Failed to cancel appeal" });
  }
};

export const addAppealEvidence = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const appealId = typeof req.params.appealId === "string"
    ? req.params.appealId
    : undefined;
  const fileIds = parseFileIds(req.body?.fileIds);
  if (!appealId || !isUuid(appealId) || !fileIds) {
    res.status(400).json({ message: "Valid appealId and fileIds are required" });
    return;
  }
  let staged: Array<{ id: string; objectKey: string }> = [];
  try {
    const existing = await appealRepository.findAppealById(appealId);
    if (!existing) throw new AppealNotFoundError(appealId);
    const studentId = actorId(req, res, "studentId") ?? existing.studentId;
    staged = await storeEvidenceFiles(
      (req as AuthenticatedRequest & { files?: UploadedFile[] }).files,
    );
    const ids = [...fileIds, ...staged.map((asset) => asset.id)];
    if (ids.length === 0) {
      throw new AppealValidationError("At least one evidence file is required");
    }
    const appeal = await appealRepository.addEvidence(appealId, studentId, ids);
    res.json(appealResponse(appeal));
  } catch (error) {
    await cleanupAssets(staged);
    if (sendAppealError(res, error)) return;
    console.error("Failed to add appeal evidence:", error);
    res.status(500).json({ message: "Failed to add appeal evidence" });
  }
};

export const removeAppealEvidence = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const appealId = typeof req.params.appealId === "string"
    ? req.params.appealId
    : undefined;
  const fileId = typeof req.params.fileId === "string" ? req.params.fileId : undefined;
  if (!appealId || !fileId || !isUuid(appealId) || !isUuid(fileId)) {
    res.status(400).json({ message: "Valid appeal and file IDs are required" });
    return;
  }
  try {
    const existing = await appealRepository.findAppealById(appealId);
    if (!existing) throw new AppealNotFoundError(appealId);
    const studentId = actorId(req, res, "studentId") ?? existing.studentId;
    const appeal = await appealRepository.removeEvidence(
      appealId,
      studentId,
      fileId,
    );
    res.json(appealResponse(appeal));
  } catch (error) {
    if (sendAppealError(res, error)) return;
    console.error("Failed to remove appeal evidence:", error);
    res.status(500).json({ message: "Failed to remove appeal evidence" });
  }
};

export const downloadAppealEvidence = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const appealId = typeof req.params.appealId === "string"
    ? req.params.appealId
    : undefined;
  const fileId = typeof req.params.fileId === "string" ? req.params.fileId : undefined;
  if (!appealId || !fileId || !isUuid(appealId) || !isUuid(fileId)) {
    res.status(400).json({ message: "Valid appeal and file IDs are required" });
    return;
  }
  try {
    const appeal = await appealRepository.findAppealById(appealId);
    if (!appeal) throw new AppealNotFoundError(appealId);
    if (!(await canReadAppeal(req as AuthenticatedRequest, appeal))) {
      throw new AppealForbiddenError();
    }
    const link = appeal.files.find((item) => item.fileId === fileId);
    if (!link?.file) throw new AppealNotFoundError(appealId);
    res.download(fileStorage.resolvePath(link.file.objectKey), link.file.originalName);
  } catch (error) {
    if (sendAppealError(res, error)) return;
    console.error("Failed to download appeal evidence:", error);
    res.status(500).json({ message: "Failed to download appeal evidence" });
  }
};

export const reviewAppealWithAi = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const appealId = typeof req.params.appealId === "string"
    ? req.params.appealId
    : undefined;
  const lecturerId = actorId(req, res, "reviewerId");
  if (!appealId || !isUuid(appealId) || !lecturerId) {
    res.status(400).json({ message: "Valid appealId and reviewerId are required" });
    return;
  }
  const autoResolve = req.body?.autoResolve === true || req.body?.autoResolve === "true";
  try {
    const appeal = await appealAiService.review({
      appealId,
      lecturerId,
      autoResolve,
    });
    await notificationService.safely("AI appeal review", () =>
      notificationService.notifyAppeal(appeal.id),
    );
    if (autoResolve && appeal.resultEvaluationId) {
      await notificationService.safely("AI appeal grade", () =>
        notificationService.notifyEvaluationCompleted(appeal.resultEvaluationId!),
      );
    }
    res.json(appealResponse(appeal));
  } catch (error) {
    if (sendAppealError(res, error)) return;
    console.error("Failed to review appeal with AI:", error);
    res.status(502).json({ message: "AI appeal review failed" });
  }
};

export const resolveAppeal = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const appealId =
    typeof req.params.appealId === "string" ? req.params.appealId : undefined;

  if (!appealId || !isUuid(appealId)) {
    res.status(400).json({ message: "A valid appeal ID is required" });
    return;
  }

  const { status, resolution, newScore } = req.body || {};
  const reviewerId = actorId(req, res, "reviewerId");

  if (!status || (status !== AppealStatus.ACCEPTED && status !== AppealStatus.REJECTED)) {
    res.status(400).json({
      message: "A valid status ('ACCEPTED' or 'REJECTED') is required",
    });
    return;
  }

  if (typeof resolution !== "string" || !resolution.trim()) {
    res.status(400).json({ message: "A resolution explanation is required" });
    return;
  }

  if (!reviewerId || !isUuid(reviewerId)) {
    res.status(400).json({ message: "A valid reviewerId (lecturer ID) is required" });
    return;
  }

  const parsedScore =
    newScore !== undefined && newScore !== null
      ? typeof newScore === "number"
        ? newScore
        : parseFloat(newScore)
      : undefined;

  if (parsedScore !== undefined && (isNaN(parsedScore) || parsedScore < 0)) {
    res.status(400).json({ message: "newScore must be a non-negative number" });
    return;
  }

  try {
    const updatedAppeal = await appealRepository.resolveAppeal(appealId, {
      status,
      resolution: resolution.trim(),
      reviewerId,
      newScore: parsedScore,
    });

    await notificationService.safely("appeal resolved", () =>
      notificationService.notifyAppeal(updatedAppeal.id),
    );
    if (updatedAppeal.resultEvaluationId) {
      await notificationService.safely("appeal grade", () =>
        notificationService.notifyEvaluationCompleted(
          updatedAppeal.resultEvaluationId!,
        ),
      );
    }

    res.json(appealResponse(updatedAppeal));
  } catch (error) {
    if (sendAppealError(res, error)) return;

    console.error("Failed to resolve appeal:", error);
    res.status(500).json({ message: "Failed to resolve appeal" });
  }
};
