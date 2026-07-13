import { Router } from "express";
import {
  createLecturer,
  getLecturerById,
} from "../controllers/lecturer.controller.js";
import {
  createStudent,
  getStudentById,
  getStudentsByCourseId,
} from "../controllers/student.controller.js";

export const userRouter = Router();

/**
 * @openapi
 * /students:
 *   post:
 *     tags: [Students]
 *     summary: Create a student
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *     responses:
 *       201:
 *         description: Student created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Student'
 *       400:
 *         description: Invalid request
 *       409:
 *         description: Email already exists
 *       500:
 *         description: Server error
 */
userRouter.post("/students", createStudent);

/**
 * @openapi
 * /students/{studentId}:
 *   get:
 *     tags: [Students]
 *     summary: Get a student by ID
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
 *         description: Student
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Student'
 *       400:
 *         description: Invalid student ID
 *       404:
 *         description: Student not found
 *       500:
 *         description: Server error
 */
userRouter.get("/students/:studentId", getStudentById);

/**
 * @openapi
 * /courses/{courseId}/students:
 *   get:
 *     tags: [Students, Courses]
 *     summary: Get active students enrolled in a course
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
 *         description: Students
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Student'
 *       400:
 *         description: Invalid course ID
 *       500:
 *         description: Server error
 */
userRouter.get("/courses/:courseId/students", getStudentsByCourseId);

/**
 * @openapi
 * /lecturers:
 *   post:
 *     tags: [Lecturers]
 *     summary: Create a lecturer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *     responses:
 *       201:
 *         description: Lecturer created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Lecturer'
 *       400:
 *         description: Invalid request
 *       409:
 *         description: Email already exists
 *       500:
 *         description: Server error
 */
userRouter.post("/lecturers", createLecturer);

/**
 * @openapi
 * /lecturers/{lecturerId}:
 *   get:
 *     tags: [Lecturers]
 *     summary: Get a lecturer by ID
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
 *         description: Lecturer
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Lecturer'
 *       400:
 *         description: Invalid lecturer ID
 *       404:
 *         description: Lecturer not found
 *       500:
 *         description: Server error
 */
userRouter.get("/lecturers/:lecturerId", getLecturerById);
