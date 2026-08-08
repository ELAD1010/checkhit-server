import { Router } from "express";
import {
  createSubmission,
  getSubmission,
  listAssignmentSubmissions,
  submitSubmission,
  updateDraftSubmission,
} from "../controllers/submission.controller.js";
import { getEvaluation } from "../controllers/evaluation.controller.js";
import {
  requireLtiAuth,
  requireStudent,
} from "../middleware/lti-auth.js";
import { uploadSingleDocument } from "../middleware/upload.js";

export const submissionRouter = Router();

/**
 * @openapi
 * /assignments/{assignmentId}/submissions:
 *   get:
 *     tags: [Submissions]
 *     summary: List submissions for an assignment
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Submissions
 */
submissionRouter.get(
  "/assignments/:assignmentId/submissions",
  requireLtiAuth,
  listAssignmentSubmissions,
);

/**
 * @openapi
 * /assignments/{assignmentId}/submissions:
 *   post:
 *     tags: [Submissions]
 *     summary: Create a student submission
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               answerText:
 *                 type: string
 *               submit:
 *                 type: string
 *                 enum: ["true", "false"]
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Draft submission created
 *       202:
 *         description: Submission accepted for grading
 */
submissionRouter.post(
  "/assignments/:assignmentId/submissions",
  requireLtiAuth,
  requireStudent,
  uploadSingleDocument.array("files", 5),
  createSubmission,
);

/**
 * @openapi
 * /submissions/{submissionId}/submit:
 *   post:
 *     tags: [Submissions]
 *     summary: Submit a draft submission for grading
 *     parameters:
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       202:
 *         description: Submission accepted for grading
 */
submissionRouter.post(
  "/submissions/:submissionId/submit",
  requireLtiAuth,
  requireStudent,
  submitSubmission,
);

/**
 * @openapi
 * /submissions/{submissionId}:
 *   patch:
 *     tags: [Submissions]
 *     summary: Update an existing draft submission
 *     parameters:
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               answerText:
 *                 type: string
 *               clearFiles:
 *                 type: string
 *                 enum: ["true", "false"]
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Draft submission updated
 *       409:
 *         description: Submission already submitted
 */
submissionRouter.patch(
  "/submissions/:submissionId",
  requireLtiAuth,
  requireStudent,
  uploadSingleDocument.array("files", 5),
  updateDraftSubmission,
);

/**
 * @openapi
 * /submissions/{submissionId}:
 *   get:
 *     tags: [Submissions]
 *     summary: Get a submission
 *     parameters:
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Submission
 */
submissionRouter.get(
  "/submissions/:submissionId",
  requireLtiAuth,
  getSubmission,
);

/**
 * @openapi
 * /evaluations/{evaluationId}:
 *   get:
 *     tags: [Evaluations]
 *     summary: Get evaluation status and per-question results
 *     parameters:
 *       - in: path
 *         name: evaluationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Evaluation
 */
submissionRouter.get(
  "/evaluations/:evaluationId",
  requireLtiAuth,
  getEvaluation,
);
