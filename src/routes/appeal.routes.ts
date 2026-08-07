import { Router } from "express";
import {
  getAppealById,
  getLecturerAppeals,
  getLecturerAppealsStats,
  getStudentAppeals,
  resolveAppeal,
} from "../controllers/appeal.controller.js";

export const appealRouter = Router();

/**
 * @openapi
 * /students/{studentId}/appeals:
 *   get:
 *     tags: [Students, Appeals]
 *     summary: Get all appeals submitted by a student
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
 *         description: Limit the number of appeals returned
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: status
 *         required: false
 *         description: Filter by appeal status (e.g. IN_PROGRESS, SUBMITTED, UNDER_REVIEW, ACCEPTED, REJECTED, CANCELLED)
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Array of student appeals with related submission, evaluation, and assignment details
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Appeal'
 *       400:
 *         description: Invalid student ID
 *       404:
 *         description: Student not found
 *       500:
 *         description: Server error
 */
appealRouter.get("/students/:studentId/appeals", getStudentAppeals);

/**
 * @openapi
 * /lecturers/{lecturerId}/appeals:
 *   get:
 *     tags: [Lecturers, Appeals]
 *     summary: Get all appeals for courses taught by a lecturer
 *     parameters:
 *       - in: path
 *         name: lecturerId
 *         required: true
 *         description: Lecturer user ID
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: status
 *         required: false
 *         description: Filter by status tab (PENDING, RESOLVED, SUBMITTED, UNDER_REVIEW, ACCEPTED, REJECTED, CANCELLED)
 *         schema:
 *           type: string
 *       - in: query
 *         name: courseId
 *         required: false
 *         description: Filter appeals by specific course ID
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: search
 *         required: false
 *         description: Search query by student name or student ID
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         required: false
 *         description: Limit number of results
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Array of appeals across the lecturer's courses
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Appeal'
 *       400:
 *         description: Invalid lecturer ID or filter parameters
 *       404:
 *         description: Lecturer not found
 *       500:
 *         description: Server error
 */
appealRouter.get("/lecturers/:lecturerId/appeals", getLecturerAppeals);

/**
 * @openapi
 * /lecturers/{lecturerId}/appeals/stats:
 *   get:
 *     tags: [Lecturers, Appeals]
 *     summary: Get summary stats of appeals (pending, resolved, total) for a lecturer
 *     parameters:
 *       - in: path
 *         name: lecturerId
 *         required: true
 *         description: Lecturer user ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Appeals statistics summary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LecturerAppealsStats'
 *       400:
 *         description: Invalid lecturer ID
 *       404:
 *         description: Lecturer not found
 *       500:
 *         description: Server error
 */
appealRouter.get("/lecturers/:lecturerId/appeals/stats", getLecturerAppealsStats);

/**
 * @openapi
 * /appeals/{appealId}:
 *   get:
 *     tags: [Appeals]
 *     summary: Get full details of a single appeal by ID
 *     parameters:
 *       - in: path
 *         name: appealId
 *         required: true
 *         description: Appeal UUID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Full appeal details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appeal'
 *       400:
 *         description: Invalid appeal ID
 *       404:
 *         description: Appeal not found
 *       500:
 *         description: Server error
 *   patch:
 *     tags: [Appeals]
 *     summary: Resolve an appeal (accept or reject) and optionally update the grade
 *     parameters:
 *       - in: path
 *         name: appealId
 *         required: true
 *         description: Appeal UUID
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResolveAppealRequest'
 *     responses:
 *       200:
 *         description: Successfully resolved appeal
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appeal'
 *       400:
 *         description: Invalid request payload
 *       404:
 *         description: Appeal or Lecturer not found
 *       500:
 *         description: Server error
 */
appealRouter.get("/appeals/:appealId", getAppealById);
appealRouter.patch("/appeals/:appealId", resolveAppeal);
appealRouter.patch("/appeals/:appealId/resolve", resolveAppeal);
