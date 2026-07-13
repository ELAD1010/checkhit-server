import { Router } from "express";
import {
  createAssignment,
  deleteAssignment,
  getAssignmentById,
  getCourseAssignments,
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
