import { Request, Response } from "express";
import {
  DashboardRepository,
  LecturerNotFoundError,
} from "../repositories/dashboard.repository.js";
import { UserRepository } from "../repositories/user.repository.js";
import {
  getDatabaseErrorCode,
  isUuid,
  parseCreateUserInput,
} from "./user-controller.utils.js";

const userRepository = new UserRepository();
const dashboardRepository = new DashboardRepository();

export const createLecturer = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const input = parseCreateUserInput(req.body);

  if (!input) {
    res.status(400).json({
      message: "name and a valid email are required",
    });
    return;
  }

  try {
    const lecturer = await userRepository.createLecturer(input);
    res.status(201).json(lecturer);
  } catch (error) {
    if (getDatabaseErrorCode(error) === "23505") {
      res
        .status(409)
        .json({ message: "A user with this email already exists" });
      return;
    }

    console.error("Failed to create lecturer:", error);
    res.status(500).json({ message: "Failed to create lecturer" });
  }
};

export const getLecturerById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const lecturerId =
    typeof req.params.lecturerId === "string"
      ? req.params.lecturerId
      : undefined;

  if (!lecturerId || !isUuid(lecturerId)) {
    res.status(400).json({ message: "A valid lecturer ID is required" });
    return;
  }

  try {
    const lecturer = await userRepository.findLecturerById(lecturerId);

    if (!lecturer) {
      res.status(404).json({ message: "Lecturer not found" });
      return;
    }

    res.json(lecturer);
  } catch (error) {
    console.error("Failed to fetch lecturer:", error);
    res.status(500).json({ message: "Failed to fetch lecturer" });
  }
};

export const getLecturerDashboard = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const lecturerId =
    typeof req.params.lecturerId === "string"
      ? req.params.lecturerId
      : undefined;

  if (!lecturerId || !isUuid(lecturerId)) {
    res.status(400).json({ message: "A valid lecturer ID is required" });
    return;
  }

  try {
    const dashboardData =
      await dashboardRepository.getLecturerDashboard(lecturerId);
    res.json(dashboardData);
  } catch (error) {
    if (error instanceof LecturerNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    console.error("Failed to fetch lecturer dashboard:", error);
    res.status(500).json({ message: "Failed to fetch lecturer dashboard" });
  }
};

