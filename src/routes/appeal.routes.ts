import { Router } from "express";
import {
  addAppealEvidence,
  cancelAppeal,
  claimAppeal,
  createAppeal,
  downloadAppealEvidence,
  getAppealById,
  getLecturerAppeals,
  getLecturerAppealsStats,
  getStudentAppeals,
  resolveAppeal,
  removeAppealEvidence,
  reviewAppealWithAi,
} from "../controllers/appeal.controller.js";
import { uploadSingleDocument } from "../middleware/upload.js";
import { optionalLtiAuth } from "../middleware/lti-auth.js";

export const appealRouter = Router();
appealRouter.use(optionalLtiAuth);

/**
 * @openapi
 * /appeals:
 *   post:
 *     tags: [Appeals]
 *     summary: Submit a student appeal for a completed evaluation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateAppealRequest'
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [submissionId, reason]
 *             properties:
 *               submissionId: { type: string, format: uuid }
 *               studentId: { type: string, format: uuid }
 *               reason: { type: string, minLength: 20 }
 *               category: { type: string }
 *               fileIds: { type: string, description: JSON array of existing file UUIDs }
 *               files:
 *                 type: array
 *                 maxItems: 5
 *                 items: { type: string, format: binary }
 *     responses:
 *       201: { description: Appeal created }
 *       400: { description: Invalid or ungraded submission }
 *       409: { description: Active appeal already exists }
 */
appealRouter.post(
  "/appeals",
  uploadSingleDocument.array("files", 5),
  createAppeal,
);

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

/**
 * @openapi
 * /appeals/{appealId}/claim:
 *   patch:
 *     tags: [Appeals, Lecturers]
 *     summary: Assign an appeal to a course lecturer and begin review
 *     parameters:
 *       - in: path
 *         name: appealId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Appeal claimed }
 *       403: { description: Lecturer is not assigned to the course }
 *       409: { description: Appeal is assigned or already resolved }
 */
appealRouter.patch("/appeals/:appealId/claim", claimAppeal);

/**
 * @openapi
 * /appeals/{appealId}/cancel:
 *   patch:
 *     tags: [Appeals, Students]
 *     summary: Cancel an appeal before review starts
 *     parameters:
 *       - in: path
 *         name: appealId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Appeal cancelled }
 *       403: { description: Appeal belongs to another student }
 *       409: { description: Review has already started }
 */
appealRouter.patch("/appeals/:appealId/cancel", cancelAppeal);

/**
 * @openapi
 * /appeals/{appealId}/evidence:
 *   post:
 *     tags: [Appeals, Students]
 *     summary: Add evidence before appeal review starts
 *     parameters:
 *       - in: path
 *         name: appealId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               studentId: { type: string, format: uuid }
 *               fileIds: { type: string, description: JSON array of file UUIDs }
 *               files:
 *                 type: array
 *                 maxItems: 5
 *                 items: { type: string, format: binary }
 *     responses:
 *       200: { description: Updated appeal }
 *       409: { description: Review has already started }
 */
appealRouter.post(
  "/appeals/:appealId/evidence",
  uploadSingleDocument.array("files", 5),
  addAppealEvidence,
);
appealRouter.delete(
  "/appeals/:appealId/evidence/:fileId",
  removeAppealEvidence,
);
appealRouter.get(
  "/appeals/:appealId/evidence/:fileId",
  downloadAppealEvidence,
);

/**
 * @openapi
 * /appeals/{appealId}/ai-review:
 *   post:
 *     tags: [Appeals, Lecturers]
 *     summary: Generate an AI recommendation or let AI resolve the appeal
 *     parameters:
 *       - in: path
 *         name: appealId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AiAppealReviewRequest'
 *     responses:
 *       200: { description: Appeal with AI recommendation or decision }
 *       403: { description: Lecturer is not assigned to the course }
 *       409: { description: Appeal is assigned elsewhere or already resolved }
 *       502: { description: AI provider failed }
 */
appealRouter.post("/appeals/:appealId/ai-review", reviewAppealWithAi);
