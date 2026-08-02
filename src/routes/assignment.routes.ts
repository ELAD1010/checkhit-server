import { Router } from "express";
import {
  createAssignment,
  deleteAssignment,
  getAllStudentAssignments,
  getAssignmentById,
  getCourseAssignments,
  getStudentCourseAssignments,
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
 * /assignments/{assignmentId}:
 *   get:
 *     tags: [Assignments]
 *     summary: Get an assignment by ID
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         description: Assignment ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Assignment
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Assignment'
 *       400:
 *         description: Invalid assignment ID
 *       404:
 *         description: Assignment not found
 *       500:
 *         description: Server error
 */
assignmentRouter.get("/assignments/:assignmentId", getAssignmentById);

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
