import { Request, Response } from "express";
import { AssignmentStatus } from "../entities/enums.js";
import {
  AssignmentCourseNotFoundError,
  AssignmentNotFoundError,
  AssignmentRepository,
  AssignmentStudentNotFoundError,
  CreateAssignmentInput,
  StudentNotEnrolledInCourseError,
} from "../repositories/assignment.repository.js";
import { getDatabaseErrorCode, isUuid } from "./user-controller.utils.js";

const assignmentRepository = new AssignmentRepository();

const parseOptionalDate = (
  value: unknown,
): { valid: boolean; value: Date | null } => {
  if (value === undefined || value === null || value === "") {
    return { valid: true, value: null };
  }

  if (typeof value !== "string") {
    return { valid: false, value: null };
  }

  const date = new Date(value);
  return {
    valid: !Number.isNaN(date.getTime()),
    value: Number.isNaN(date.getTime()) ? null : date,
  };
};

const parseCreateAssignmentInput = (
  courseId: string,
  body: unknown,
): CreateAssignmentInput | null => {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const {
    name,
    description,
    type,
    evaluationInstructions,
    maxScore,
    startAt,
    dueAt,
    status,
  } = body as Record<string, unknown>;
  const parsedStartAt = parseOptionalDate(startAt);
  const parsedDueAt = parseOptionalDate(dueAt);

  if (
    typeof name !== "string" ||
    name.trim() === "" ||
    typeof description !== "string" ||
    typeof type !== "string" ||
    type.trim() === "" ||
    typeof evaluationInstructions !== "string" ||
    typeof maxScore !== "number" ||
    !Number.isFinite(maxScore) ||
    maxScore <= 0 ||
    !parsedStartAt.valid ||
    !parsedDueAt.valid ||
    (status !== undefined &&
      (typeof status !== "string" ||
        !Object.values(AssignmentStatus).includes(
          status as AssignmentStatus,
        ))) ||
    (parsedStartAt.value &&
      parsedDueAt.value &&
      parsedDueAt.value <= parsedStartAt.value)
  ) {
    return null;
  }

  return {
    courseId,
    name: name.trim(),
    description: description.trim(),
    type: type.trim(),
    evaluationInstructions: evaluationInstructions.trim(),
    maxScore,
    startAt: parsedStartAt.value,
    dueAt: parsedDueAt.value,
    status: status as AssignmentStatus | undefined,
  };
};

export const createAssignment = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const courseId =
    typeof req.params.courseId === "string" ? req.params.courseId : undefined;

  if (!courseId || !isUuid(courseId)) {
    res.status(400).json({ message: "A valid course ID is required" });
    return;
  }

  const input = parseCreateAssignmentInput(courseId, req.body);

  if (!input) {
    res.status(400).json({
      message:
        "Invalid assignment. name, description, type, evaluationInstructions, and a positive maxScore are required",
    });
    return;
  }

  try {
    const assignment = await assignmentRepository.createAssignment(input);
    res.status(201).json(assignment);
  } catch (error) {
    if (error instanceof AssignmentCourseNotFoundError) {
      res.status(404).json({ message: "Course not found" });
      return;
    }

    if (getDatabaseErrorCode(error) === "23514") {
      res.status(400).json({ message: "Assignment constraints were violated" });
      return;
    }

    console.error("Failed to create assignment:", error);
    res.status(500).json({ message: "Failed to create assignment" });
  }
};

export const getAssignmentById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const assignmentId =
    typeof req.params.assignmentId === "string"
      ? req.params.assignmentId
      : undefined;

  if (!assignmentId || !isUuid(assignmentId)) {
    res.status(400).json({ message: "A valid assignment ID is required" });
    return;
  }

  const studentId =
    typeof req.query.studentId === "string" && req.query.studentId.trim() !== ""
      ? req.query.studentId.trim()
      : typeof req.params.studentId === "string" &&
          req.params.studentId.trim() !== ""
        ? req.params.studentId.trim()
        : (res.locals?.token?.user as string | undefined);

  if (studentId && !isUuid(studentId)) {
    res.status(400).json({ message: "A valid student ID is required" });
    return;
  }

  try {
    if (studentId) {
      const studentAssignment =
        await assignmentRepository.findStudentAssignmentDetail(
          assignmentId,
          studentId,
        );

      if (!studentAssignment) {
        res.status(404).json({ message: "Assignment not found" });
        return;
      }

      res.json(studentAssignment);
      return;
    }

    const assignment =
      await assignmentRepository.findAssignmentById(assignmentId);

    if (!assignment) {
      res.status(404).json({ message: "Assignment not found" });
      return;
    }

    res.json(assignment);
  } catch (error) {
    if (error instanceof AssignmentStudentNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    console.error("Failed to fetch assignment:", error);
    res.status(500).json({ message: "Failed to fetch assignment" });
  }
};

export const getStudentAssignmentDetail = getAssignmentById;

export const getCourseAssignments = async (
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
    const assignments =
      await assignmentRepository.findAssignmentsByCourseId(courseId);
    res.json(assignments);
  } catch (error) {
    if (error instanceof AssignmentCourseNotFoundError) {
      res.status(404).json({ message: "Course not found" });
      return;
    }

    console.error("Failed to fetch course assignments:", error);
    res.status(500).json({ message: "Failed to fetch course assignments" });
  }
};

export const getStudentCourseAssignments = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const studentId =
    typeof req.params.studentId === "string" ? req.params.studentId : undefined;
  const courseId =
    typeof req.params.courseId === "string" ? req.params.courseId : undefined;

  if (!studentId || !isUuid(studentId)) {
    res.status(400).json({ message: "A valid student ID is required" });
    return;
  }

  if (!courseId || !isUuid(courseId)) {
    res.status(400).json({ message: "A valid course ID is required" });
    return;
  }

  try {
    const assignments =
      await assignmentRepository.findStudentAssignmentsWithStatus(
        studentId,
        courseId,
      );
    res.json(assignments);
  } catch (error) {
    if (error instanceof AssignmentStudentNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    if (error instanceof AssignmentCourseNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    if (error instanceof StudentNotEnrolledInCourseError) {
      res.status(404).json({ message: error.message });
      return;
    }

    console.error("Failed to fetch student course assignments:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch student course assignments" });
  }
};

export const getAllStudentAssignments = async (
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
  const upcoming =
    req.query.upcoming === "true" || req.query.upcoming === "1";
  const sort =
    typeof req.query.sort === "string" ? req.query.sort : undefined;

  try {
    const assignments =
      await assignmentRepository.findAllStudentAssignmentsWithStatus(
        studentId,
        {
          limit: limit && !isNaN(limit) ? limit : undefined,
          status,
          upcoming,
          sort,
        },
      );
    res.json(assignments);
  } catch (error) {
    if (error instanceof AssignmentStudentNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    console.error("Failed to fetch student assignments:", error);
    res.status(500).json({ message: "Failed to fetch student assignments" });
  }
};

export const getStudentRecentGrades = async (
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
    : 5;

  try {
    const grades = await assignmentRepository.findStudentRecentGrades(
      studentId,
      !isNaN(limit) && limit > 0 ? limit : 5,
    );
    res.json(grades);
  } catch (error) {
    if (error instanceof AssignmentStudentNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    console.error("Failed to fetch student recent grades:", error);
    res.status(500).json({ message: "Failed to fetch student recent grades" });
  }
};

export const deleteAssignment = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const assignmentId =
    typeof req.params.assignmentId === "string"
      ? req.params.assignmentId
      : undefined;

  if (!assignmentId || !isUuid(assignmentId)) {
    res.status(400).json({ message: "A valid assignment ID is required" });
    return;
  }

  try {
    const deleted = await assignmentRepository.deleteAssignment(assignmentId);

    if (!deleted) {
      res.status(404).json({ message: "Assignment not found" });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete assignment:", error);
    res.status(500).json({ message: "Failed to delete assignment" });
  }
};

export const getLecturerAssignmentOverview = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const assignmentId =
    typeof req.params.assignmentId === "string"
      ? req.params.assignmentId
      : undefined;

  if (!assignmentId || !isUuid(assignmentId)) {
    res.status(400).json({ message: "A valid assignment ID is required" });
    return;
  }

  const search =
    typeof req.query.search === "string" ? req.query.search : undefined;
  const status =
    typeof req.query.status === "string" ? req.query.status : undefined;

  try {
    const overview = await assignmentRepository.findLecturerAssignmentOverview(
      assignmentId,
      { search, status },
    );
    res.json(overview);
  } catch (error) {
    if (error instanceof AssignmentNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    console.error("Failed to fetch lecturer assignment overview:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch lecturer assignment overview" });
  }
};
