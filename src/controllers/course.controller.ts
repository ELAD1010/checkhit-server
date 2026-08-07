import { Request, Response } from "express";
import {
  CourseRepository,
  CreateCourseInput,
  LecturersNotFoundError,
} from "../repositories/course.repository.js";
import { getDatabaseErrorCode, isUuid } from "./user-controller.utils.js";

const courseRepository = new CourseRepository();

const parseCreateCourseInput = (body: unknown): CreateCourseInput | null => {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const { name, semester, academicYear, lecturerIds } =
    body as Record<string, unknown>;

  if (
    typeof name !== "string" ||
    name.trim() === "" ||
    typeof semester !== "string" ||
    semester.trim() === "" ||
    typeof academicYear !== "number" ||
    !Number.isInteger(academicYear) ||
    academicYear < 0 ||
    academicYear > 32767 ||
    !Array.isArray(lecturerIds) ||
    lecturerIds.length === 0 ||
    !lecturerIds.every(
      (lecturerId) => typeof lecturerId === "string" && isUuid(lecturerId),
    )
  ) {
    return null;
  }

  return {
    name: name.trim(),
    semester: semester.trim(),
    academicYear,
    lecturerIds: [...new Set(lecturerIds)],
  };
};

export const createCourse = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const input = parseCreateCourseInput(req.body);

  if (!input) {
    res.status(400).json({
      message:
        "name, semester, academicYear, and at least one valid lecturer ID are required",
    });
    return;
  }

  try {
    const course = await courseRepository.createCourse(input);
    res.status(201).json(course);
  } catch (error) {
    if (error instanceof LecturersNotFoundError) {
      res.status(400).json({
        message: "One or more lecturers do not exist",
        lecturerIds: error.lecturerIds,
      });
      return;
    }

    if (getDatabaseErrorCode(error) === "23505") {
      res.status(409).json({ message: "The course already exists" });
      return;
    }

    console.error("Failed to create course:", error);
    res.status(500).json({ message: "Failed to create course" });
  }
};

export const getCourseById = async (
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
    const course = await courseRepository.findCourseById(courseId);

    if (!course) {
      res.status(404).json({ message: "Course not found" });
      return;
    }

    res.json(course);
  } catch (error) {
    console.error("Failed to fetch course:", error);
    res.status(500).json({ message: "Failed to fetch course" });
  }
};

export const getLecturerCourses = async (
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
    const courses = await courseRepository.findCoursesByLecturerId(lecturerId);
    res.json(courses);
  } catch (error) {
    console.error("Failed to fetch lecturer courses:", error);
    res.status(500).json({ message: "Failed to fetch lecturer courses" });
  }
};

export const getStudentCourses = async (
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
  const sortBy =
    typeof req.query.sortBy === "string" ? req.query.sortBy : undefined;

  try {
    const courses = await courseRepository.findCoursesByStudentId(studentId, {
      limit: limit && !isNaN(limit) ? limit : undefined,
      sortBy,
    });
    res.json(courses);
  } catch (error) {
    console.error("Failed to fetch student courses:", error);
    res.status(500).json({ message: "Failed to fetch student courses" });
  }
};

export const getStudentUrgentCourses = async (
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

  try {
    const courses = await courseRepository.findUrgentCoursesByStudentId(
      studentId,
      limit && !isNaN(limit) ? limit : undefined,
    );
    res.json(courses);
  } catch (error) {
    console.error("Failed to fetch urgent student courses:", error);
    res.status(500).json({ message: "Failed to fetch urgent student courses" });
  }
};

export const deleteCourse = async (
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
    const deleted = await courseRepository.deleteCourse(courseId);

    if (!deleted) {
      res.status(404).json({ message: "Course not found" });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete course:", error);
    res.status(500).json({ message: "Failed to delete course" });
  }
};
