import { Router } from "express";
import {
  getQuestionImportStatus,
  importAssignmentQuestionsFromDocument,
  listAssignmentQuestions,
  replaceAssignmentQuestions,
} from "../controllers/question.controller.js";
import {
  requireLecturer,
  requireLtiAuth,
} from "../middleware/lti-auth.js";
import { uploadSingleDocument } from "../middleware/upload.js";

export const questionRouter = Router();

/**
 * @openapi
 * /assignments/{assignmentId}/questions:
 *   get:
 *     tags: [Questions]
 *     summary: List assignment questions
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Questions
 *       401:
 *         description: Missing LTI session
 *       404:
 *         description: Assignment not found
 */
questionRouter.get(
  "/assignments/:assignmentId/questions",
  requireLtiAuth,
  listAssignmentQuestions,
);

/**
 * @openapi
 * /assignments/{assignmentId}/questions:
 *   put:
 *     tags: [Questions]
 *     summary: Replace assignment questions
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
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReplaceQuestionsRequest'
 *     responses:
 *       200:
 *         description: Questions replaced
 *       400:
 *         description: Invalid questions
 *       403:
 *         description: Lecturer role required
 */
questionRouter.put(
  "/assignments/:assignmentId/questions",
  requireLtiAuth,
  requireLecturer,
  replaceAssignmentQuestions,
);

/**
 * @openapi
 * /assignments/{assignmentId}/question-imports:
 *   post:
 *     tags: [Questions]
 *     summary: Import questions from an uploaded assignment document
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
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       202:
 *         description: Question import accepted
 *       400:
 *         description: Invalid upload
 *       403:
 *         description: Lecturer role required
 */
questionRouter.post(
  "/assignments/:assignmentId/question-imports",
  requireLtiAuth,
  requireLecturer,
  uploadSingleDocument.single("file"),
  importAssignmentQuestionsFromDocument,
);

/**
 * @openapi
 * /question-imports/{importId}:
 *   get:
 *     tags: [Questions]
 *     summary: Get question import status
 *     parameters:
 *       - in: path
 *         name: importId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Import status
 *       404:
 *         description: Import not found
 */
questionRouter.get(
  "/question-imports/:importId",
  requireLtiAuth,
  requireLecturer,
  getQuestionImportStatus,
);
