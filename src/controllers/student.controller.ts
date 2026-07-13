import { Request, Response } from "express";
import { UserRepository } from "../repositories/user.repository.js";
import {
  getDatabaseErrorCode,
  isUuid,
  parseCreateUserInput,
} from "./user-controller.utils.js";

const userRepository = new UserRepository();

export const createStudent = async (
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
    const student = await userRepository.createStudent(input);
    res.status(201).json(student);
  } catch (error) {
    if (getDatabaseErrorCode(error) === "23505") {
      res
        .status(409)
        .json({ message: "A user with this email already exists" });
      return;
    }

    console.error("Failed to create student:", error);
    res.status(500).json({ message: "Failed to create student" });
  }
};

export const getStudentById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const studentId =
    typeof req.params.studentId === "string" ? req.params.studentId : undefined;

  if (!studentId || !isUuid(studentId)) {
    res.status(400).json({ message: "A valid student ID is required" });
    return;
  }

  try {
    const student = await userRepository.findStudentById(studentId);

    if (!student) {
      res.status(404).json({ message: "Student not found" });
      return;
    }

    res.json(student);
  } catch (error) {
    console.error("Failed to fetch student:", error);
    res.status(500).json({ message: "Failed to fetch student" });
  }
};

export const getStudentsByCourseId = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const courseId =
    typeof req.params.courseId === "string" ? req.params.courseId : undefined;

  if (!courseId || !isUuid(courseId)) {
    res.status(400).json({ message: "A valid course ID is required" });
    return;
  }

  try {
    const students = await userRepository.findStudentsByCourseId(courseId);
    res.json(students);
  } catch (error) {
    console.error("Failed to fetch course students:", error);
    res.status(500).json({ message: "Failed to fetch course students" });
  }
};
