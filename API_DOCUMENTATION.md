# CheckHit API Documentation

Welcome to the **CheckHit API** documentation. This REST API facilitates managing students, lecturers, courses, assignments, enrollments, and Moodle LTI deep-linking for the CheckHit platform.

- **Base URL**: `/api` (e.g., `http://localhost:3001/api`)
- **Version**: `1.0.0`
- **OpenAPI Specification**: `3.1.0`
- **Authentication**: `ltiToken` query parameter (`?ltik=<token>`) issued by `ltijs` after an LTI launch where required.

---

## Table of Contents
1. [Data Models & Schemas](#data-models--schemas)
2. [Students Endpoints](#1-students)
   - [Create a Student](#post-apistudents)
   - [Get Student by ID](#get-apistudentsstudentid)
   - [Get Enrolled Students for a Course](#get-apicoursescourseidstudents)
3. [Lecturers Endpoints](#2-lecturers)
   - [Create a Lecturer](#post-apilecturers)
   - [Get Lecturer by ID](#get-apilecturerslecturerid)
4. [Courses Endpoints](#3-courses)
   - [Create a Course](#post-apicourses)
   - [Get Course by ID](#get-apicoursescourseid)
   - [Delete a Course](#delete-apicoursescourseid)
   - [Get Courses Managed by a Lecturer](#get-apilecturerslectureridcourses)
   - [Get Courses for an Enrolled Student](#get-apistudentsstudentidcourses)
5. [Assignments Endpoints](#4-assignments)
   - [Create an Assignment](#post-apicoursescourseidassignments)
   - [Get Assignments for a Course](#get-apicoursescourseidassignments)
   - [Get Assignment by ID](#get-apiassignmentsassignmentid)
   - [Delete an Assignment](#delete-apiassignmentsassignmentid)
6. [LTI Integration Endpoints](#5-lti-integration)
   - [Generate Deep-Link Form](#post-apigenerate-deeplink)

---

## Data Models & Schemas

### User Roles & Enums
- **UserRole**: `"STUDENT"` | `"LECTURER"`
- **LecturerPermission**: `"OWNER"` | `"EDITOR"`
- **AssignmentStatus**: `"DRAFT"` | `"PUBLISHED"` | `"CLOSED"` | `"ARCHIVED"`

### Core Object Schemas

#### `User`
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string (uuid)` | Unique user identifier. |
| `name` | `string` | User's full display name. |
| `email` | `string (email)` | Unique user email address. |
| `role` | `enum` | `"STUDENT"` or `"LECTURER"`. |
| `ltiSubject` | `string \| null` | External LTI sub claim ID (if synced via LMS). |
| `createdAt` | `string (date-time)` | Timestamp of account creation. |
| `updatedAt` | `string (date-time)` | Timestamp of last account update. |

#### `Student` / `Lecturer`
| Field | Type | Description |
| :--- | :--- | :--- |
| `userId` | `string (uuid)` | Foreign key matching `User.id`. |
| `user` | `User` | Embedded User object. |

#### `Course`
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string (uuid)` | Unique course identifier. |
| `name` | `string` | Course title/name. |
| `semester` | `string` | Academic semester (e.g., `"Fall"`, `"Spring"`). |
| `academicYear` | `integer` | Academic year (e.g., `2026`). |
| `ltiContextId` | `string \| null` | LMS Context/Course ID. |
| `lecturers` | `CourseLecturer[]` | List of assigned lecturers with permissions. |
| `createdAt` | `string (date-time)` | Record creation timestamp. |
| `updatedAt` | `string (date-time)` | Record update timestamp. |

#### `Assignment`
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string (uuid)` | Unique assignment identifier. |
| `courseId` | `string (uuid)` | Identifier of the parent course. |
| `name` | `string` | Assignment title. |
| `description` | `string` | Assignment instructions and description. |
| `type` | `string` | Category/Type (e.g., `"Coding"`, `"Essay"`, `"Project"`). |
| `evaluationInstructions` | `string` | AI / Automated evaluation grading instructions. |
| `maxScore` | `number` | Maximum possible score (> 0). |
| `status` | `enum` | `"DRAFT"`, `"PUBLISHED"`, `"CLOSED"`, or `"ARCHIVED"`. |
| `startAt` | `string (date-time) \| null` | When assignment opens. |
| `dueAt` | `string (date-time) \| null` | Submission deadline. |
| `ltiResourceLinkId` | `string \| null` | LMS Resource Link ID. |
| `ltiLineItemUrl` | `string (uri) \| null` | LMS Gradebook Line Item URL. |
| `createdAt` | `string (date-time)` | Record creation timestamp. |
| `updatedAt` | `string (date-time)` | Record update timestamp. |

---

## 1. Students

### `POST /api/students`
Creates a new student account in the platform.

- **Tags**: `Students`
- **Request Body** (`application/json`):
  ```json
  {
    "name": "Alice Johnson",
    "email": "alice.johnson@student.university.edu",
    "ltiSubject": "lti-user-sub-12345" // optional
  }
  ```
- **Responses**:
  - **`201 Created`**: Returns created `Student` object.
    ```json
    {
      "userId": "c3ad6ef2-7841-458c-9bce-904ad4aa5bb1",
      "user": {
        "id": "c3ad6ef2-7841-458c-9bce-904ad4aa5bb1",
        "name": "Alice Johnson",
        "email": "alice.johnson@student.university.edu",
        "role": "STUDENT",
        "ltiSubject": "lti-user-sub-12345",
        "createdAt": "2026-08-02T13:54:23.000Z",
        "updatedAt": "2026-08-02T13:54:23.000Z"
      }
    }
    ```
  - **`400 Bad Request`**: Validation failed (e.g., missing name/email or invalid format).
  - **`409 Conflict`**: A user with this email address already exists.
  - **`500 Internal Server Error`**: Unexpected server error.

---

### `GET /api/students/{studentId}`
Fetches student profile and associated user details by student ID.

- **Tags**: `Students`
- **Path Parameters**:
  - `studentId` (`uuid`, required): The student user ID.
- **Responses**:
  - **`200 OK`**: Returns the `Student` object.
  - **`400 Bad Request`**: Invalid UUID format.
  - **`404 Not Found`**: Student not found.
  - **`500 Internal Server Error`**: Server error.

---

### `GET /api/courses/{courseId}/students`
Retrieves all active students enrolled in a specific course.

- **Tags**: `Students`, `Courses`
- **Path Parameters**:
  - `courseId` (`uuid`, required): The course ID.
- **Responses**:
  - **`200 OK`**: Array of `Student` objects.
    ```json
    [
      {
        "userId": "c3ad6ef2-7841-458c-9bce-904ad4aa5bb1",
        "user": {
          "id": "c3ad6ef2-7841-458c-9bce-904ad4aa5bb1",
          "name": "Alice Johnson",
          "email": "alice.johnson@student.university.edu",
          "role": "STUDENT"
        }
      }
    ]
    ```
  - **`400 Bad Request`**: Invalid course ID format.
  - **`500 Internal Server Error`**: Server error.

---

## 2. Lecturers

### `POST /api/lecturers`
Creates a new lecturer account.

- **Tags**: `Lecturers`
- **Request Body** (`application/json`):
  ```json
  {
    "name": "Dr. Alan Turing",
    "email": "alan.turing@university.edu",
    "ltiSubject": null
  }
  ```
- **Responses**:
  - **`201 Created`**: Returns created `Lecturer` object with embedded `User`.
  - **`400 Bad Request`**: Invalid input data.
  - **`409 Conflict`**: Email already registered.
  - **`500 Internal Server Error`**: Server error.

---

### `GET /api/lecturers/{lecturerId}`
Fetches lecturer profile by lecturer ID.

- **Tags**: `Lecturers`
- **Path Parameters**:
  - `lecturerId` (`uuid`, required): The lecturer user ID.
- **Responses**:
  - **`200 OK`**: Returns `Lecturer` object.
  - **`400 Bad Request`**: Invalid lecturer UUID.
  - **`404 Not Found`**: Lecturer not found.
  - **`500 Internal Server Error`**: Server error.

---

## 3. Courses

### `POST /api/courses`
Creates a course and associates assigned lecturers.
*Note: The first lecturer listed in `lecturerIds` is assigned as `OWNER`; all subsequent lecturers become `EDITOR`s.*

- **Tags**: `Courses`
- **Request Body** (`application/json`):
  ```json
  {
    "name": "CS101: Introduction to Computer Science",
    "semester": "Fall",
    "academicYear": 2026,
    "lecturerIds": [
      "bbb5766e-a71e-42b1-a056-467926e9a722",
      "94e6ce9e-f00e-4361-b445-5ecdc34f9a0c"
    ],
    "ltiContextId": "course-context-101" // optional
  }
  ```
- **Responses**:
  - **`201 Created`**: Returns the newly created `Course` object including its `lecturers` associations.
  - **`400 Bad Request`**: Invalid payload or lecturer ID not found.
  - **`409 Conflict`**: Course conflict / duplicate.
  - **`500 Internal Server Error`**: Server error.

---

### `GET /api/courses/{courseId}`
Retrieves detailed course information by ID, including assigned lecturers and permission levels.

- **Tags**: `Courses`
- **Path Parameters**:
  - `courseId` (`uuid`, required): The course ID.
- **Responses**:
  - **`200 OK`**: Returns `Course` object.
    ```json
    {
      "id": "ffa88441-f78e-4e44-b110-6ab402f5cc10",
      "name": "CS101: Introduction to Computer Science",
      "semester": "Fall",
      "academicYear": 2026,
      "ltiContextId": null,
      "lecturers": [
        {
          "courseId": "ffa88441-f78e-4e44-b110-6ab402f5cc10",
          "lecturerId": "bbb5766e-a71e-42b1-a056-467926e9a722",
          "permissionLevel": "OWNER",
          "assignedAt": "2026-08-02T13:54:23.000Z"
        }
      ],
      "createdAt": "2026-08-02T13:54:23.000Z",
      "updatedAt": "2026-08-02T13:54:23.000Z"
    }
    ```
  - **`400 Bad Request`**: Invalid course ID format.
  - **`404 Not Found`**: Course not found.
  - **`500 Internal Server Error`**: Server error.

---

### `DELETE /api/courses/{courseId}`
Deletes a course and cascades deletion to related entities (assignments, enrollments, resources).

- **Tags**: `Courses`
- **Path Parameters**:
  - `courseId` (`uuid`, required): The course ID.
- **Responses**:
  - **`204 No Content`**: Course successfully deleted.
  - **`400 Bad Request`**: Invalid course UUID.
  - **`404 Not Found`**: Course not found.
  - **`500 Internal Server Error`**: Server error.

---

### `GET /api/lecturers/{lecturerId}/courses`
Retrieves all courses where the specified lecturer is assigned as an Owner or Editor.

- **Tags**: `Courses`, `Lecturers`
- **Path Parameters**:
  - `lecturerId` (`uuid`, required): Lecturer's user ID.
- **Responses**:
  - **`200 OK`**: Array of `Course` objects.
  - **`400 Bad Request`**: Invalid lecturer ID.
  - **`500 Internal Server Error`**: Server error.

---

### `GET /api/students/{studentId}/courses`
Retrieves all courses where the specified student is actively enrolled.

- **Tags**: `Courses`, `Students`
- **Path Parameters**:
  - `studentId` (`uuid`, required): Student's user ID.
- **Responses**:
  - **`200 OK`**: Array of `Course` objects.
  - **`400 Bad Request`**: Invalid student ID.
  - **`500 Internal Server Error`**: Server error.

---

## 4. Assignments

### `POST /api/courses/{courseId}/assignments`
Creates a new assignment under the given course.

- **Tags**: `Assignments`
- **Path Parameters**:
  - `courseId` (`uuid`, required): The parent course ID.
- **Request Body** (`application/json`):
  ```json
  {
    "name": "Homework 1: Hello World & Variables",
    "description": "Write a program that prints Hello World and performs arithmetic operations.",
    "type": "Coding",
    "evaluationInstructions": "Verify syntax correctness, descriptive variable naming, and matching output format.",
    "maxScore": 100,
    "status": "PUBLISHED", // "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED"
    "startAt": "2026-07-19T13:54:23.000Z", // optional (ISO 8601)
    "dueAt": "2026-08-09T13:54:23.000Z",   // optional (ISO 8601)
    "ltiResourceLinkId": null,             // optional
    "ltiLineItemUrl": null                 // optional
  }
  ```
- **Responses**:
  - **`201 Created`**: Returns created `Assignment` object.
  - **`400 Bad Request`**: Validation failure (e.g. `dueAt` is before `startAt` or `maxScore <= 0`).
  - **`404 Not Found`**: Course not found.
  - **`500 Internal Server Error`**: Server error.

---

### `GET /api/courses/{courseId}/assignments`
Retrieves all assignments configured for a course.

- **Tags**: `Assignments`
- **Path Parameters**:
  - `courseId` (`uuid`, required): The course ID.
- **Responses**:
  - **`200 OK`**: Array of `Assignment` objects.
  - **`400 Bad Request`**: Invalid course ID.
  - **`404 Not Found`**: Course not found.
  - **`500 Internal Server Error`**: Server error.

---

### `GET /api/assignments/{assignmentId}`
Retrieves a single assignment by its ID.

- **Tags**: `Assignments`
- **Path Parameters**:
  - `assignmentId` (`uuid`, required): The assignment ID.
- **Responses**:
  - **`200 OK`**: Returns `Assignment` object.
  - **`400 Bad Request`**: Invalid assignment ID.
  - **`404 Not Found`**: Assignment not found.
  - **`500 Internal Server Error`**: Server error.

---

### `DELETE /api/assignments/{assignmentId}`
Deletes an assignment by ID along with its submissions and evaluations.

- **Tags**: `Assignments`
- **Path Parameters**:
  - `assignmentId` (`uuid`, required): The assignment ID.
- **Responses**:
  - **`204 No Content`**: Assignment successfully deleted.
  - **`400 Bad Request`**: Invalid assignment ID.
  - **`404 Not Found`**: Assignment not found.
  - **`500 Internal Server Error`**: Server error.

---

## 5. LTI Integration

### `POST /api/generate-deeplink`
Generates an auto-submitting HTML form that completes the LTI 1.3 Deep Linking workflow back to Moodle or an LMS platform.

- **Tags**: `LTI`
- **Security**: Requires an active LTI session (`ltik` token).
- **Request Body** (`application/json`):
  ```json
  {
    "taskTitle": "Homework 1: Hello World",
    "maxScore": 100,
    "taskId": "ffa88441-f78e-4e44-b110-6ab402f5cc10"
  }
  ```
- **Responses**:
  - **`200 OK`** (`text/html`): HTML form with signed JWT payload that submits the deep link response to LMS.
  - **`401 Unauthorized`**: Missing or invalid LTI session.
  - **`500 Internal Server Error`**: Error generating deep link.
