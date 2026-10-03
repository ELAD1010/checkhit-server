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
  removeAppealEvidence,
  reviewAppealWithAi,
  resolveAppeal,
} from "../controllers/appeal.controller.js";
import {
  requireLecturer,
  requireLtiAuth,
  requireStudent,
} from "../middleware/lti-auth.js";
import {
  uploadSingleDocument,
  uploadSinglePdf,
} from "../middleware/upload.js";

export const appealRouter = Router();

/**
 * @openapi
 * /appeals:
 *   post:
 *     tags: [Appeals]
 *     summary: Submit an appeal for the authenticated student's graded submission
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/CreateAppealRequest'
 *     responses:
 *       201:
 *         description: Appeal created
 *       400:
 *         description: Invalid or ungraded submission, reason, category, or PDF
 *       403:
 *         description: The submission does not belong to the student
 *       409:
 *         description: The submission already has an appeal
 */
appealRouter.post(
  "/appeals",
  requireLtiAuth,
  requireStudent,
  uploadSinglePdf.single("file"),
  createAppeal,
);

/**
 * @openapi
 * /students/{studentId}/appeals:
 *   get:
 *     tags: [Appeals]
 *     summary: List the authenticated student's appeals
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Student appeals
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Appeal' }
 *       403:
 *         description: The path does not identify the authenticated student
 */
appealRouter.get(
  "/students/:studentId/appeals",
  requireLtiAuth,
  requireStudent,
  getStudentAppeals,
);
/**
 * @openapi
 * /lecturers/{lecturerId}/appeals/stats:
 *   get:
 *     tags: [Appeals]
 *     summary: Count appeals for the authenticated lecturer's courses
 *     responses:
 *       200:
 *         description: Appeal counts
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/LecturerAppealsStats' }
 */
appealRouter.get(
  "/lecturers/:lecturerId/appeals/stats",
  requireLtiAuth,
  requireLecturer,
  getLecturerAppealsStats,
);
/**
 * @openapi
 * /lecturers/{lecturerId}/appeals:
 *   get:
 *     tags: [Appeals]
 *     summary: List appeals from courses assigned to the authenticated lecturer
 *     responses:
 *       200:
 *         description: Lecturer course appeals
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Appeal' }
 */
appealRouter.get(
  "/lecturers/:lecturerId/appeals",
  requireLtiAuth,
  requireLecturer,
  getLecturerAppeals,
);

/**
 * @openapi
 * /appeals/{appealId}/claim:
 *   patch:
 *     tags: [Appeals]
 *     summary: Claim an appeal for the authenticated course lecturer
 *     responses:
 *       200:
 *         description: Appeal claimed, or already claimed by this lecturer
 *       409:
 *         description: Appeal was claimed or resolved elsewhere
 */
appealRouter.patch(
  "/appeals/:appealId/claim",
  requireLtiAuth,
  requireLecturer,
  claimAppeal,
);

/**
 * @openapi
 * /appeals/{appealId}/cancel:
 *   patch:
 *     tags: [Appeals]
 *     summary: Cancel the authenticated student's unreviewed appeal
 *     responses:
 *       200:
 *         description: Appeal cancelled
 *       409:
 *         description: Review has already started
 */
appealRouter.patch(
  "/appeals/:appealId/cancel",
  requireLtiAuth,
  requireStudent,
  cancelAppeal,
);

/**
 * @openapi
 * /appeals/{appealId}/evidence:
 *   post:
 *     tags: [Appeals]
 *     summary: Add evidence to the authenticated student's unreviewed appeal
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [files]
 *             properties:
 *               files:
 *                 type: array
 *                 maxItems: 5
 *                 items: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Evidence added
 *       409:
 *         description: Review has already started
 */
appealRouter.post(
  "/appeals/:appealId/evidence",
  requireLtiAuth,
  requireStudent,
  uploadSingleDocument.array("files", 5),
  addAppealEvidence,
);

/**
 * @openapi
 * /appeals/{appealId}/evidence/{fileId}:
 *   delete:
 *     tags: [Appeals]
 *     summary: Remove evidence from the authenticated student's unreviewed appeal
 *     responses:
 *       200:
 *         description: Evidence removed
 *       409:
 *         description: Review has already started
 */
appealRouter.delete(
  "/appeals/:appealId/evidence/:fileId",
  requireLtiAuth,
  requireStudent,
  removeAppealEvidence,
);

/**
 * @openapi
 * /appeals/{appealId}/evidence/{fileId}:
 *   get:
 *     tags: [Appeals]
 *     summary: Download authorized PDF evidence
 *     responses:
 *       200:
 *         description: PDF evidence
 *       403:
 *         description: User cannot access this appeal
 *       404:
 *         description: Appeal or evidence was not found
 */
appealRouter.get(
  "/appeals/:appealId/evidence/:fileId",
  requireLtiAuth,
  downloadAppealEvidence,
);

/**
 * @openapi
 * /appeals/{appealId}/ai-review:
 *   post:
 *     tags: [Appeals]
 *     summary: Generate or apply an AI appeal recommendation
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AiAppealReviewRequest' }
 *     responses:
 *       200:
 *         description: AI review completed
 *       502:
 *         description: AI review failed
 */
appealRouter.post(
  "/appeals/:appealId/ai-review",
  requireLtiAuth,
  requireLecturer,
  reviewAppealWithAi,
);

/**
 * @openapi
 * /appeals/{appealId}:
 *   get:
 *     tags: [Appeals]
 *     summary: Read an appeal authorized by student ownership or lecturer course assignment
 *     responses:
 *       200:
 *         description: Appeal detail
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Appeal' }
 *       403:
 *         description: The authenticated user cannot access the appeal
 *   patch:
 *     tags: [Appeals]
 *     summary: Accept or reject an appeal claimed by the authenticated lecturer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ResolveAppealRequest' }
 *     responses:
 *       200:
 *         description: Resolved appeal
 *       400:
 *         description: Invalid decision, resolution, or revised score
 *       409:
 *         description: Appeal is unclaimed, assigned elsewhere, or already resolved
 */
appealRouter.get("/appeals/:appealId", requireLtiAuth, getAppealById);
appealRouter.patch(
  "/appeals/:appealId",
  requireLtiAuth,
  requireLecturer,
  resolveAppeal,
);
appealRouter.patch(
  "/appeals/:appealId/resolve",
  requireLtiAuth,
  requireLecturer,
  resolveAppeal,
);
