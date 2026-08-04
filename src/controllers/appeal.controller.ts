import { Request, Response } from "express";
import {
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
