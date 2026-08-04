import { Request, Response } from "express";
import { AppealStatus } from "../entities/enums.js";
import {
  AppealLecturerNotFoundError,
  AppealNotFoundError,
  AppealRepository,
  AppealStudentNotFoundError,
} from "../repositories/appeal.repository.js";
import { isUuid } from "./user-controller.utils.js";

const appealRepository = new AppealRepository();

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
    res.json(appeals);
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
    res.json(appeals);
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

    res.json(appeal);
  } catch (error) {
    console.error("Failed to fetch appeal by ID:", error);
    res.status(500).json({ message: "Failed to fetch appeal" });
  }
};

export const resolveAppeal = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const appealId =
    typeof req.params.appealId === "string" ? req.params.appealId : undefined;

  if (!appealId || !isUuid(appealId)) {
    res.status(400).json({ message: "A valid appeal ID is required" });
    return;
  }

  const { status, resolution, reviewerId: bodyReviewerId, newScore } = req.body || {};
  const tokenUserId = res.locals.token?.user;
  const reviewerId =
    (typeof bodyReviewerId === "string" && bodyReviewerId) ||
    (typeof tokenUserId === "string" && tokenUserId ? tokenUserId : undefined);

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

    res.json(updatedAppeal);
  } catch (error) {
    if (error instanceof AppealNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }
    if (error instanceof AppealLecturerNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    console.error("Failed to resolve appeal:", error);
    res.status(500).json({ message: "Failed to resolve appeal" });
  }
};
