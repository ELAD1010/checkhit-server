import { Router } from "express";
import { getStudentAppeals } from "../controllers/appeal.controller.js";

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
