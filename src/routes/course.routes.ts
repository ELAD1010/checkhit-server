import { Router } from "express";
import {
  createCourse,
  deleteCourse,
  getCourseById,
  getLecturerCourses,
  getStudentCourses,
  getStudentUrgentCourses,
} from "../controllers/course.controller.js";

export const courseRouter = Router();

/**
 * @openapi
 * /courses:
 *   post:
 *     tags: [Courses]
 *     summary: Create a course
 *     description: The first lecturer becomes the owner; additional lecturers become editors.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCourseRequest'
 *     responses:
 *       201:
 *         description: Course created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Course'
 *       400:
 *         description: Invalid request or lecturer not found
 *       409:
 *         description: Course conflict
 *       500:
 *         description: Server error
 */
courseRouter.post("/courses", createCourse);

/**
 * @openapi
 * /courses/{courseId}:
 *   get:
 *     tags: [Courses]
 *     summary: Get a course by ID
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
 *         description: Course
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Course'
 *       400:
 *         description: Invalid course ID
 *       404:
 *         description: Course not found
 *       500:
 *         description: Server error
 */
courseRouter.get("/courses/:courseId", getCourseById);

/**
 * @openapi
 * /lecturers/{lecturerId}/courses:
 *   get:
 *     tags: [Courses, Lecturers]
 *     summary: Get courses managed by a lecturer
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
 *         description: Courses
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Course'
 *       400:
 *         description: Invalid lecturer ID
 *       500:
 *         description: Server error
 */
courseRouter.get("/lecturers/:lecturerId/courses", getLecturerCourses);

/**
 * @openapi
 * /students/{studentId}/courses:
 *   get:
 *     tags: [Courses, Students]
 *     summary: Get courses for an actively enrolled student
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
 *         description: Limit the number of courses returned
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: sortBy
 *         required: false
 *         description: Sort criteria (e.g. urgency, name, recent)
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Courses
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Course'
 *       400:
 *         description: Invalid student ID
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
courseRouter.get("/students/:studentId/courses", getStudentCourses);

/**
 * @openapi
 * /students/{studentId}/courses/urgent:
 *   get:
 *     tags: [Courses, Students]
 *     summary: Get enrolled courses sorted by urgency (upcoming assignment deadlines and open assignments)
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
 *         description: Limit the number of urgent courses returned (e.g. 3)
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: List of enrolled courses sorted by urgency with openAssignmentsCount and nextDueAt
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Course'
 *       400:
 *         description: Invalid student ID
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
courseRouter.get(
  "/students/:studentId/courses/urgent",
  getStudentUrgentCourses,
);

/**
 * @openapi
 * /courses/{courseId}:
 *   delete:
 *     tags: [Courses]
 *     summary: Delete a course
 *     description: Deletes the course and dependent records configured with cascade deletion.
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         description: Course ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Course deleted
 *       400:
 *         description: Invalid course ID
 *       404:
 *         description: Course not found
 *       500:
 *         description: Server error
 */
courseRouter.delete("/courses/:courseId", deleteCourse);
