import { Router } from "express";
import {
  createAssignment,
  deleteAssignment,
  getAllStudentAssignments,
  getAssignmentById,
  getCourseAssignments,
  getLecturerAssignmentOverview,
  getStudentAssignmentDetail,
  getStudentCourseAssignments,
  getStudentRecentGrades,
} from "../controllers/assignment.controller.js";

export const assignmentRouter = Router();

/**
 * @openapi
 * /courses/{courseId}/assignments:
 *   post:
 *     tags: [Assignments]
 *     summary: Create an assignment in a course
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         description: Course ID
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateAssignmentRequest'
 *     responses:
 *       201:
 *         description: Assignment created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Assignment'
 *       400:
 *         description: Invalid assignment
 *       404:
 *         description: Course not found
 *       500:
 *         description: Server error
 */
assignmentRouter.post("/courses/:courseId/assignments", createAssignment);

/**
 * @openapi
 * /courses/{courseId}/assignments:
 *   get:
 *     tags: [Assignments]
 *     summary: Get assignments for a course
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         description: Course ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Assignments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Assignment'
 *       400:
 *         description: Invalid course ID
 *       404:
 *         description: Course not found
 *       500:
 *         description: Server error
 */
assignmentRouter.get("/courses/:courseId/assignments", getCourseAssignments);

/**
 * @openapi
 * /students/{studentId}/courses/{courseId}/assignments:
 *   get:
 *     tags: [Assignments, Students, Courses]
 *     summary: Get assignments for a course with student completion status
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         description: Student user ID
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: courseId
 *         required: true
 *         description: Course ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of course assignments with student completion status
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/StudentAssignment'
 *       400:
 *         description: Invalid student ID or course ID
 *       404:
 *         description: Student or course not found, or student is not enrolled
 *       500:
 *         description: Server error
 */
assignmentRouter.get(
  "/students/:studentId/courses/:courseId/assignments",
  getStudentCourseAssignments,
);

/**
 * @openapi
 * /students/{studentId}/assignments:
 *   get:
 *     tags: [Assignments, Students]
 *     summary: Get all assignments across enrolled courses with student completion status
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         description: Student user ID
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         required: false
 *         description: Limit the number of assignments returned
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: status
 *         required: false
 *         description: Filter by status (UPCOMING, GRADED, NOT_STARTED, DRAFT, SUBMITTED, OVERDUE)
 *         schema:
 *           type: string
 *       - in: query
 *         name: upcoming
 *         required: false
 *         description: Set to true to return only active/upcoming unsubmitted assignments sorted by dueAt ASC
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: sort
 *         required: false
 *         description: Sort order (e.g. dueAt:asc, dueAt:desc, gradedAt:desc, createdAt:desc)
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Assignments with student completion status and course details
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/StudentAssignment'
 *       400:
 *         description: Invalid student ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Student not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
assignmentRouter.get(
  "/students/:studentId/assignments",
  getAllStudentAssignments,
);

/**
 * @openapi
 * /students/{studentId}/grades:
 *   get:
 *     tags: [Assignments, Students]
 *     summary: Get student recent graded assignments sorted by evaluation date descending
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         description: Student user ID
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         required: false
 *         description: Number of recent grades to fetch (defaults to 5)
 *         schema:
 *           type: integer
 *           default: 5
 *           minimum: 1
 *     responses:
 *       200:
 *         description: List of recently graded assignments with scores and feedback
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/StudentAssignment'
 *       400:
 *         description: Invalid student ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Student not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
assignmentRouter.get(
  "/students/:studentId/grades",
  getStudentRecentGrades,
);

/**
 * @openapi
 * /assignments/{assignmentId}:
 *   get:
 *     tags: [Assignments]
 *     summary: Get an assignment by ID (optionally includes student submission/evaluation/appeal if studentId is supplied)
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         description: Assignment ID
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: studentId
 *         required: false
 *         description: Optional student user ID to include personal submission, evaluation, files, and appeal status
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Assignment details (or Student Assignment Details if studentId provided)
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/Assignment'
 *                 - $ref: '#/components/schemas/StudentAssignmentDetail'
 *       400:
 *         description: Invalid assignment or student ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Assignment or Student not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
assignmentRouter.get("/assignments/:assignmentId", getAssignmentById);

/**
 * @openapi
 * /students/{studentId}/assignments/{assignmentId}:
 *   get:
 *     tags: [Assignments, Students]
 *     summary: Get full assignment details for a specific student (includes submission, files, evaluation, and appeal)
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         description: Student user ID
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         description: Assignment ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Student Assignment details with submission, evaluation, and appeal
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudentAssignmentDetail'
 *       400:
 *         description: Invalid assignment or student ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Assignment or Student not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
assignmentRouter.get(
  "/students/:studentId/assignments/:assignmentId",
  getStudentAssignmentDetail,
);

/**
 * @openapi
 * /assignments/{assignmentId}:
 *   delete:
 *     tags: [Assignments]
 *     summary: Delete an assignment
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         description: Assignment ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Assignment deleted
 *       400:
 *         description: Invalid assignment ID
 *       404:
 *         description: Assignment not found
 *       500:
 *         description: Server error
 */
assignmentRouter.delete("/assignments/:assignmentId", deleteAssignment);

/**
 * @openapi
 * /assignments/{assignmentId}/lecturer-overview:
 *   get:
 *     tags: [Assignments, Lecturers]
 *     summary: Get lecturer overview for an assignment (metadata, KPIs, and complete student roster)
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         description: Assignment ID
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: search
 *         required: false
 *         description: Filter students by name, email, or student number
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         required: false
 *         description: Filter student submissions by status (GRADED, EVALUATING, SUBMITTED, NOT_STARTED, OVERDUE, APPEAL)
 *         schema:
 *           type: string
 *           enum: [GRADED, EVALUATING, SUBMITTED, NOT_STARTED, OVERDUE, APPEAL]
 *     responses:
 *       200:
 *         description: Lecturer assignment overview with stats and student roster
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LecturerAssignmentOverviewResponse'
 *       400:
 *         description: Invalid assignment ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Assignment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
assignmentRouter.get(
  "/assignments/:assignmentId/lecturer-overview",
  getLecturerAssignmentOverview,
);

