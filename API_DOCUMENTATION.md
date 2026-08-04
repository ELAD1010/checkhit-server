# CheckHit API Documentation

Welcome to the **CheckHit API** documentation. This REST API facilitates managing students, lecturers, courses, assignments, enrollments, appeals, and Moodle LTI deep-linking for the CheckHit platform.

- **Base URL**: `/api` (e.g., `http://localhost:3001/api`)
- **Version**: `1.0.0`
- **OpenAPI Specification**: `3.1.0`
- **Authentication**: `ltiToken` query parameter (`?ltik=<token>`) issued by `ltijs` after an LTI launch where required.

---

## Table of Contents
1. [Data Models & Schemas](#data-models--schemas)
2. [1. Students Endpoints](#1-students)
   - [Create a Student (`POST /api/students`)](#post-apistudents)
   - [Get Student by ID (`GET /api/students/{studentId}`)](#get-apistudentsstudentid)
   - [Get Enrolled Students for a Course (`GET /api/courses/{courseId}/students`)](#get-apicoursescourseidstudents)
   - [Get All Student Assignments Across All Courses (`GET /api/students/{studentId}/assignments`)](#get-apistudentsstudentidassignments)
   - [Get Course Assignments with Student Completion Status (`GET /api/students/{studentId}/courses/{courseId}/assignments`)](#get-apistudentsstudentidcoursescourseidassignments)
   - [Get Student Appeals (`GET /api/students/{studentId}/appeals`)](#get-apistudentsstudentidappeals)
3. [2. Lecturers Endpoints](#2-lecturers)
   - [Create a Lecturer (`POST /api/lecturers`)](#post-apilecturers)
   - [Get Lecturer by ID (`GET /api/lecturers/{lecturerId}`)](#get-apilecturerslecturerid)
4. [3. Courses Endpoints](#3-courses)
   - [Create a Course (`POST /api/courses`)](#post-apicourses)
   - [Get Course by ID (`GET /api/courses/{courseId}`)](#get-apicoursescourseid)
   - [Delete a Course (`DELETE /api/courses/{courseId}`)](#delete-apicoursescourseid)
   - [Get Courses Managed by a Lecturer (`GET /api/lecturers/{lecturerId}/courses`)](#get-apilecturerslectureridcourses)
   - [Get Courses for an Enrolled Student (`GET /api/students/{studentId}/courses`)](#get-apistudentsstudentidcourses)
5. [4. Assignments Endpoints](#4-assignments)
   - [Create an Assignment (`POST /api/courses/{courseId}/assignments`)](#post-apicoursescourseidassignments)
   - [Get Assignments for a Course (`GET /api/courses/{courseId}/assignments`)](#get-apicoursescourseidassignments)
   - [Get All Student Assignments Across All Courses (`GET /api/students/{studentId}/assignments`)](#get-apistudentsstudentidassignments-1)
   - [Get Course Assignments with Student Completion Status (`GET /api/students/{studentId}/courses/{courseId}/assignments`)](#get-apistudentsstudentidcoursescourseidassignments-1)
   - [Get Assignment by ID (`GET /api/assignments/{assignmentId}`)](#get-apiassignmentsassignmentid)
   - [Delete an Assignment (`DELETE /api/assignments/{assignmentId}`)](#delete-apiassignmentsassignmentid)
6. [5. Appeals Endpoints](#5-appeals)
   - [Get Student Appeals (`GET /api/students/{studentId}/appeals`)](#get-apistudentsstudentidappeals-1)
7. [6. LTI Integration Endpoints](#6-lti-integration)
   - [Generate Deep-Link Form (`POST /api/generate-deeplink`)](#post-apigenerate-deeplink)
8. [7. Notifications Endpoints](#7-notifications)
   - [Get User Notifications (`GET /api/users/{userId}/notifications`)](#get-apiusersuseridnotifications)
   - [Get Unread Notifications Count (`GET /api/users/{userId}/notifications/unread-count`)](#get-apiusersuseridnotificationsunread-count)
   - [Mark Single Notification as Read (`PATCH /api/notifications/{id}/read`)](#patch-apinotificationsidread)
   - [Mark All Notifications as Read (`PATCH /api/users/{userId}/notifications/read-all`)](#patch-apiusersuseridnotificationsread-all)
9. [8. Messages & Broadcast System](#8-messages--broadcast-system)
   - [List User Messages (`GET /api/messages`)](#get-apimessages)
   - [Get Message by ID & Thread (`GET /api/messages/{id}`)](#get-apimessagesid)
   - [Create Message or Broadcast (`POST /api/messages`)](#post-apimessages)
   - [Reply to Message Thread (`POST /api/messages/{id}/replies`)](#post-apimessagesidreplies)
   - [Mark Message as Read / Unread (`PATCH /api/messages/{id}/read`)](#patch-apimessagesidread)
   - [Archive / Unarchive Message (`PATCH /api/messages/{id}/archive`)](#patch-apimessagesidarchive)
   - [Delete Message (`DELETE /api/messages/{id}`)](#delete-apimessagesid)
   - [Get Unread Messages Count (`GET /api/messages/unread-count`)](#get-apimessagesunread-count-and-get-apiusersuseridmessagesunread-count)

---


## Data Models & Schemas

### User Roles & Enums
- **UserRole**: `"STUDENT"` | `"LECTURER"`
- **LecturerPermission**: `"OWNER"` | `"EDITOR"`
- **AssignmentStatus**: `"DRAFT"` | `"PUBLISHED"` | `"CLOSED"` | `"ARCHIVED"`
- **StudentAssignmentStatus**: `"NOT_STARTED"` | `"DRAFT"` | `"SUBMITTED"` | `"GRADED"` | `"OVERDUE"`
- **AppealStatus**: `"SUBMITTED"` | `"UNDER_REVIEW"` | `"ACCEPTED"` | `"REJECTED"` | `"CANCELLED"`
- **EvaluationStatus**: `"PENDING"` | `"PROCESSING"` | `"COMPLETED"` | `"FAILED"`
- **NotificationCategory**: `"ASSIGNMENT"` | `"GRADE"` | `"APPEAL"` | `"WARNING"` | `"SYSTEM"` | `"INFO"`
- **MessageTargetType**: `"DIRECT"` | `"BROADCAST"` | `"SYSTEM"`

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
| `studentsCount` | `integer` | Number of actively enrolled students (`status = ACTIVE`). |
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

#### `StudentAssignment`
Extends `Assignment` with student-specific submission and progress details:
| Field | Type | Description |
| :--- | :--- | :--- |
| `studentStatus` | `enum` | `"NOT_STARTED"`, `"DRAFT"`, `"SUBMITTED"`, `"GRADED"`, `"OVERDUE"`. |
| `submission` | `object \| null` | Latest submission details (attempt number, status, timestamp, and evaluation breakdown). |

#### `Appeal`
Represents a student grade appeal:
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string (uuid)` | Unique appeal identifier. |
| `submissionId` | `string (uuid)` | Identifier of the evaluated submission. |
| `evaluationId` | `string (uuid)` | Identifier of the evaluation being appealed. |
| `studentId` | `string (uuid)` | Identifier of the student. |
| `reviewerId` | `string (uuid) \| null` | Identifier of the reviewing lecturer (if assigned/reviewed). |
| `reason` | `string` | Student rationale and explanation for the appeal. |
| `status` | `enum` | `"SUBMITTED"`, `"UNDER_REVIEW"`, `"ACCEPTED"`, `"REJECTED"`, `"CANCELLED"`. |
| `resolution` | `string \| null` | Decision comments provided by the lecturer upon review. |
| `resolvedAt` | `string (date-time) \| null` | Timestamp when the appeal was resolved. |
| `submission` | `object` | Embedded submission with assignment and course details. |
| `evaluation` | `object` | Embedded evaluation with score, maxScore, and feedback. |
| `reviewer` | `object \| null` | Embedded lecturer user profile. |
| `files` | `array` | Attached evidence files. |
| `createdAt` | `string (date-time)` | Timestamp when appeal was created. |
| `updatedAt` | `string (date-time)` | Timestamp when appeal was last updated. |

#### `Notification`
Represents a user notification:
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string (uuid)` | Unique notification identifier. |
| `recipientId` | `string (uuid)` | User ID (`User.id`) of the notification recipient (student or lecturer). |
| `title` | `string` | Short title / headline of the notification. |
| `body` | `string` | Detailed notification message content. |
| `category` | `enum` | `"ASSIGNMENT"`, `"GRADE"`, `"APPEAL"`, `"WARNING"`, `"SYSTEM"`, `"INFO"`. |
| `isRead` | `boolean` | Read / unread status (`true` if read, `false` otherwise). |
| `link` | `string \| null` | Optional deep link route in the frontend (e.g., `"/student/assignments/123"`). |
| `metadata` | `object \| null` | Optional JSON key-value metadata for frontend context. |
| `readAt` | `string (date-time) \| null` | Timestamp when the notification was marked as read. |
| `createdAt` | `string (date-time)` | Timestamp when the notification was created. |
| `updatedAt` | `string (date-time)` | Timestamp when the notification was last updated. |

#### `Message`
Represents a direct message, course-wide broadcast, or system announcement:
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string (uuid)` | Unique message identifier. |
| `senderId` | `string (uuid)` | User ID (`User.id`) of the author. |
| `sender` | `User` | Embedded author profile object. |
| `targetType` | `enum` | `"DIRECT"`, `"BROADCAST"`, or `"SYSTEM"`. |
| `courseId` | `string (uuid) \| null` | Course ID if associated with a course. |
| `courseCode` | `string \| null` | Course code/abbreviation (e.g., `"CS101"`). |
| `courseName` | `string \| null` | Full course title. |
| `subject` | `string` | Message headline / subject. |
| `snippet` | `string` | Generated ~120 character preview excerpt. |
| `content` | `string` | Full message markdown / text content. |
| `isPriority` | `boolean` | Flag indicating high-priority / urgent announcement. |
| `parentMessageId` | `string (uuid) \| null` | ID of parent message if this is a reply in a thread. |
| `isRead` | `boolean` | Read status for the current querying user. |
| `readAt` | `string (date-time) \| null` | Timestamp when current user read the message. |
| `isArchived` | `boolean` | Archive status in the current user's mailbox. |
| `isSentByMe` | `boolean` | Flag indicating if current user authored the message. |
| `recipientCount` | `integer` | Total number of recipient deliveries (e.g. students in course). |
| `readCount` | `integer` | Total number of recipients who have marked as read. |
| `repliesCount` | `integer` | Count of replies in the conversation thread. |
| `replies` | `MessageReply[]` | Nested threaded replies (when fetching single message). |
| `createdAt` | `string (date-time)` | Timestamp when message was created. |
| `updatedAt` | `string (date-time)` | Timestamp when message was last updated. |

#### `MessageRecipient`
Represents per-user delivery state for 1:N broadcasts and direct messages:
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string (uuid)` | Unique recipient record ID. |
| `messageId` | `string (uuid)` | Foreign key referencing parent `Message.id`. |
| `recipientId` | `string (uuid)` | Foreign key referencing `User.id`. |
| `isRead` | `boolean` | User-specific read status (`default: false`). |
| `readAt` | `string (date-time) \| null` | Timestamp when user marked message read. |
| `isArchived` | `boolean` | User-specific archive folder status (`default: false`). |
| `isDeleted` | `boolean` | Soft-delete flag for user mailbox (`default: false`). |
| `createdAt` | `string (date-time)` | Delivery timestamp. |
| `updatedAt` | `string (date-time)` | State update timestamp. |

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

### `GET /api/students/{studentId}/assignments`
Retrieves all assignments across all courses where the student is actively enrolled, along with the student's completion status (`NOT_STARTED`, `DRAFT`, `SUBMITTED`, `GRADED`, `OVERDUE`), latest submission & evaluation, and embedded parent course details.

- **Tags**: `Students`, `Assignments`
- **Path Parameters**:
  - `studentId` (`uuid`, required): The student user ID.
- **Responses**:
  - **`200 OK`**: Array of `StudentAssignment` objects across all enrolled courses.
    ```json
    [
      {
        "id": "822b480c-3a90-43a4-b4eb-75c05ee82d83",
        "courseId": "9ac59487-edce-4306-b2d4-6f8c75c65cf6",
        "name": "Lab 1: Linked Lists & Stack Implementations",
        "description": "Implement singly linked list, doubly linked list, and stack data structures in TypeScript.",
        "type": "Code Implementation",
        "evaluationInstructions": "Verify memory cleanup, edge cases (empty stack pop, single node removal), and asymptotic runtime complexity.",
        "maxScore": 100,
        "status": "PUBLISHED",
        "startAt": "2026-07-20T00:00:00.000Z",
        "dueAt": "2026-08-10T23:59:59.000Z",
        "ltiResourceLinkId": null,
        "ltiLineItemUrl": null,
        "createdAt": "2026-07-15T10:00:00.000Z",
        "updatedAt": "2026-07-15T10:00:00.000Z",
        "course": {
          "id": "9ac59487-edce-4306-b2d4-6f8c75c65cf6",
          "name": "CS201: Data Structures and Algorithms",
          "semester": "Fall",
          "academicYear": 2026
        },
        "studentStatus": "GRADED",
        "submission": {
          "id": "90b02660-f1aa-46aa-ab91-9e7f827ad40b",
          "attemptNumber": 1,
          "status": "SUBMITTED",
          "submittedAt": "2026-07-29T23:04:04.987Z",
          "evaluation": {
            "id": "1b38cfdb-747d-4171-8be5-7f9382283cb7",
            "score": 82,
            "maxScore": 100,
            "feedback": "Good implementation of Stack and Linked List. Deducted 8 points for exception handling and 10 points for memory cleanup on deallocation.",
            "status": "COMPLETED",
            "isFinal": true
          }
        }
      },
      {
        "id": "41db74ee-c061-43d7-85ee-1ee3ba4c8130",
        "courseId": "3a936078-e09f-415b-935a-663450856f39",
        "name": "Assignment 1: A* Search and Heuristic Pathfinding",
        "description": "Implement A* graph search with Manhattan and Euclidean heuristics for 2D maze navigation.",
        "type": "Code Implementation",
        "evaluationInstructions": "Verify admissibility and consistency of heuristics, test on disconnected graphs and large grids.",
        "maxScore": 100,
        "status": "PUBLISHED",
        "startAt": "2026-07-20T00:00:00.000Z",
        "dueAt": "2026-08-15T23:59:59.000Z",
        "ltiResourceLinkId": null,
        "ltiLineItemUrl": null,
        "createdAt": "2026-07-18T10:00:00.000Z",
        "updatedAt": "2026-07-18T10:00:00.000Z",
        "course": {
          "id": "3a936078-e09f-415b-935a-663450856f39",
          "name": "CS401: Artificial Intelligence & Autonomous Systems",
          "semester": "Fall",
          "academicYear": 2026
        },
        "studentStatus": "GRADED",
        "submission": {
          "id": "c068340d-d421-4f81-a67b-1cb8ff8f817e",
          "attemptNumber": 1,
          "status": "SUBMITTED",
          "submittedAt": "2026-07-27T23:04:04.992Z",
          "evaluation": {
            "id": "1e204c3a-d68f-4aa7-b50a-bf19ec128522",
            "score": 75,
            "maxScore": 100,
            "feedback": "A* implementation finds optimal path on grid graphs, but Manhattan distance heuristic admissibility proof was considered incomplete.",
            "status": "COMPLETED",
            "isFinal": true
          }
        }
      }
    ]
    ```
  - **`400 Bad Request`**: Invalid student ID format.
  - **`404 Not Found`**: Student not found.
  - **`500 Internal Server Error`**: Server error.

---

### `GET /api/students/{studentId}/courses/{courseId}/assignments`
Retrieves all assignments in a course along with the completion status, latest submission, and evaluation for the specified student.

- **Tags**: `Students`, `Assignments`, `Courses`
- **Path Parameters**:
  - `studentId` (`uuid`, required): The student user ID.
  - `courseId` (`uuid`, required): The course ID.
- **Responses**:
  - **`200 OK`**: Array of `StudentAssignment` objects.
    ```json
    [
      {
        "id": "21adcb5c-cfeb-4202-a720-3058bc9286d9",
        "courseId": "ffa88441-f78e-4e44-b110-6ab402f5cc10",
        "name": "Homework 1: Hello World & Variables",
        "description": "Write a program that prints Hello World and performs basic arithmetic operations.",
        "type": "Coding",
        "evaluationInstructions": "Verify syntax correctness, descriptive variable naming, and matching output format.",
        "maxScore": 100,
        "status": "PUBLISHED",
        "startAt": "2026-07-12T13:54:23.000Z",
        "dueAt": "2026-08-02T13:54:23.000Z",
        "ltiResourceLinkId": null,
        "ltiLineItemUrl": null,
        "createdAt": "2026-08-02T13:54:23.000Z",
        "updatedAt": "2026-08-02T13:54:23.000Z",
        "studentStatus": "GRADED",
        "submission": {
          "id": "e4414c2b-e7b8-450f-a3ff-21ebfb2540b6",
          "attemptNumber": 1,
          "status": "SUBMITTED",
          "submittedAt": "2026-08-02T13:54:23.000Z",
          "evaluation": {
            "id": "21387d85-f5b2-4d76-8fd7-ce746b1c6d86",
            "score": 98.5,
            "maxScore": 100,
            "feedback": "Outstanding code clarity, explicit TypeScript typing, and accurate arithmetic computation.",
            "status": "COMPLETED",
            "isFinal": true
          }
        }
      }
    ]
    ```
  - **`400 Bad Request`**: Invalid student ID or course ID.
  - **`404 Not Found`**: Student not found, course not found, or student is not enrolled.
  - **`500 Internal Server Error`**: Server error.

---

### `GET /api/students/{studentId}/appeals`
Retrieves all grade appeals submitted by a student across all courses and assignments, including initial evaluations, submission details, reviewer information, and resolution status.

- **Tags**: `Students`, `Appeals`
- **Path Parameters**:
  - `studentId` (`uuid`, required): The student user ID.
- **Responses**:
  - **`200 OK`**: Array of `Appeal` objects.
    ```json
    [
      {
        "id": "7a35c59f-d3b2-4416-8a07-164478142340",
        "submissionId": "e4414c2b-e7b8-450f-a3ff-21ebfb2540b6",
        "evaluationId": "21387d85-f5b2-4d76-8fd7-ce746b1c6d86",
        "studentId": "c3ad6ef2-7841-458c-9bce-904ad4aa5bb1",
        "reviewerId": "bbb5766e-a71e-42b1-a056-467926e9a722",
        "reason": "My CustomLinkedList explicitly maintains a direct tail pointer, so getTail() executes in O(1) time.",
        "status": "ACCEPTED",
        "resolution": "Verified: CustomLinkedList maintains an active tail pointer. Penalty removed and grade updated.",
        "resolvedAt": "2026-08-01T13:54:23.000Z",
        "submission": {
          "id": "e4414c2b-e7b8-450f-a3ff-21ebfb2540b6",
          "attemptNumber": 1,
          "status": "SUBMITTED",
          "submittedAt": "2026-07-29T13:54:23.000Z",
          "assignment": {
            "id": "520ec7b9-ee6d-4ee8-b5e5-f5da2fb60a1d",
            "name": "Homework 2: Stack & Queue Implementation",
            "maxScore": 100,
            "courseId": "ffa88441-f78e-4e44-b110-6ab402f5cc10",
            "course": {
              "id": "ffa88441-f78e-4e44-b110-6ab402f5cc10",
              "name": "CS201: Data Structures",
              "semester": "Fall",
              "academicYear": 2026
            }
          }
        },
        "evaluation": {
          "id": "21387d85-f5b2-4d76-8fd7-ce746b1c6d86",
          "score": 78.0,
          "maxScore": 100,
          "feedback": "Good modular structure. Point deduction applied assuming getTail() had O(N) complexity.",
          "status": "COMPLETED",
          "isFinal": true
        },
        "reviewer": {
          "userId": "bbb5766e-a71e-42b1-a056-467926e9a722",
          "user": {
            "id": "bbb5766e-a71e-42b1-a056-467926e9a722",
            "name": "Dr. Donald Knuth",
            "email": "donald.knuth@university.edu"
          }
        },
        "files": [],
        "createdAt": "2026-07-30T13:54:23.000Z",
        "updatedAt": "2026-08-01T13:54:23.000Z"
      }
    ]
    ```
  - **`400 Bad Request`**: Invalid student UUID format.
  - **`404 Not Found`**: Student not found.
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
      "studentsCount": 6,
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
Retrieves all courses where the specified lecturer is assigned as an Owner or Editor, along with actively enrolled `studentsCount`.

- **Tags**: `Courses`, `Lecturers`
- **Path Parameters**:
  - `lecturerId` (`uuid`, required): Lecturer's user ID.
- **Responses**:
  - **`200 OK`**: Array of `Course` objects.
    ```json
    [
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
        "studentsCount": 6,
        "createdAt": "2026-08-02T13:54:23.000Z",
        "updatedAt": "2026-08-02T13:54:23.000Z"
      }
    ]
    ```
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

### `GET /api/students/{studentId}/assignments`
Retrieves all assignments across all courses where the student is actively enrolled, along with the completion status, latest submission, evaluation, and course details.

- **Tags**: `Assignments`, `Students`
- **Path Parameters**:
  - `studentId` (`uuid`, required): The student user ID.
- **Responses**:
  - **`200 OK`**: Array of `StudentAssignment` objects.
  - **`400 Bad Request`**: Invalid student ID.
  - **`404 Not Found`**: Student not found.
  - **`500 Internal Server Error`**: Server error.

---

### `GET /api/students/{studentId}/courses/{courseId}/assignments`
Retrieves all assignments in a course along with the completion status, latest submission, and evaluation for the specified student.

- **Tags**: `Assignments`, `Students`, `Courses`
- **Path Parameters**:
  - `studentId` (`uuid`, required): The student user ID.
  - `courseId` (`uuid`, required): The course ID.
- **Responses**:
  - **`200 OK`**: Array of `StudentAssignment` objects (containing assignment details, `studentStatus` (`NOT_STARTED` | `DRAFT` | `SUBMITTED` | `GRADED` | `OVERDUE`), and latest `submission` summary).
  - **`400 Bad Request`**: Invalid student ID or course ID.
  - **`404 Not Found`**: Student not found, course not found, or student is not enrolled.
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

## 5. Appeals

### `GET /api/students/{studentId}/appeals`
Retrieves all grade appeals submitted by a student across all courses and assignments, including initial evaluations, submission details, reviewer information, and resolution status.

- **Tags**: `Appeals`, `Students`
- **Path Parameters**:
  - `studentId` (`uuid`, required): The student user ID.
- **Responses**:
  - **`200 OK`**: Array of `Appeal` objects.
  - **`400 Bad Request`**: Invalid student UUID format.
  - **`404 Not Found`**: Student not found.
  - **`500 Internal Server Error`**: Server error.

---

## 6. LTI Integration

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

---

## 7. Notifications

### `GET /api/users/{userId}/notifications`
Retrieves all notifications for a given user (student or lecturer), ordered by creation date descending. Supports optional filtering for unread notifications and limiting the number of returned items (useful for navbar dropdown previews).

- **Tags**: `Notifications`
- **Path Parameters**:
  - `userId` (`uuid`, required): The user ID (student or lecturer).
- **Query Parameters**:
  - `unreadOnly` (`boolean`, optional): When `true`, filters only unread notifications (`isRead === false`).
  - `limit` (`integer`, optional): Maximum number of records to return (e.g., `?limit=10`).
- **Responses**:
  - **`200 OK`**: Array of `Notification` objects.
  - **`400 Bad Request`**: Invalid user UUID format.
  - **`404 Not Found`**: User not found.
  - **`500 Internal Server Error`**: Server error.
- **Example cURL**:
  ```bash
  curl -s "http://localhost:3001/api/users/3a12e3cb-3b43-4461-b514-5404d55e3479/notifications?limit=5"
  ```
- **Example Response**:
  ```json
  [
    {
      "id": "e38a9d12-1f44-42b7-8db1-c52efb932a41",
      "recipientId": "3a12e3cb-3b43-4461-b514-5404d55e3479",
      "title": "New Grade Entered",
      "body": "Your grade for Midterm Exam: Sorting & Complexity Analysis in CS201 has been entered (88/100).",
      "category": "GRADE",
      "isRead": false,
      "link": "/student/assignments/ab677558-ac66-4af5-9d5e-700a1e941c14",
      "metadata": {
        "assignmentId": "ab677558-ac66-4af5-9d5e-700a1e941c14",
        "score": 88,
        "maxScore": 100
      },
      "readAt": null,
      "createdAt": "2026-08-03T16:50:00.000Z",
      "updatedAt": "2026-08-03T16:50:00.000Z"
    }
  ]
  ```

---

### `GET /api/users/{userId}/notifications/unread-count`
Retrieves the total count of unread notifications for a user. Ideal for displaying notification badge badges in top navigation bars.

- **Tags**: `Notifications`
- **Path Parameters**:
  - `userId` (`uuid`, required): The user ID.
- **Responses**:
  - **`200 OK`**: `{ "unreadCount": number }`
  - **`400 Bad Request`**: Invalid user UUID format.
  - **`404 Not Found`**: User not found.
  - **`500 Internal Server Error`**: Server error.
- **Example Response**:
  ```json
  {
    "unreadCount": 3
  }
  ```

---

### `PATCH /api/notifications/{id}/read`
Marks a single notification as read, updating `isRead` to `true` and stamping `readAt` with the current timestamp.

- **Tags**: `Notifications`
- **Path Parameters**:
  - `id` (`uuid`, required): The notification ID.
- **Responses**:
  - **`200 OK`**: The updated `Notification` object.
  - **`400 Bad Request`**: Invalid notification UUID format.
  - **`404 Not Found`**: Notification not found.
  - **`500 Internal Server Error`**: Server error.

---

### `PATCH /api/users/{userId}/notifications/read-all`
Marks all unread notifications for a user as read in bulk.

- **Tags**: `Notifications`
- **Path Parameters**:
  - `userId` (`uuid`, required): The user ID.
- **Responses**:
  - **`200 OK`**: `{ "success": true, "updatedCount": number }`
  - **`400 Bad Request`**: Invalid user UUID format.
  - **`404 Not Found`**: User not found.
  - **`500 Internal Server Error`**: Server error.
- **Example Response**:
  ```json
  {
    "success": true,
    "updatedCount": 3
  }
  ```

---

## 8. Messages & Broadcast System

### `GET /api/messages`
Retrieves a paginated list of direct messages, course broadcasts, and system announcements for a user, segmented into folders (`inbox`, `sent`, `archive`).

- **Tags**: `Messages`
- **Query Parameters**:
  - `userId` (`uuid`, optional if provided via header): User ID.
  - `folder` (`string`, optional, default `inbox`): One of `inbox`, `sent`, `archive`.
  - `targetType` (`string`, optional, default `ALL`): Filter by `DIRECT`, `BROADCAST`, `SYSTEM`, or `ALL`.
  - `courseId` (`uuid`, optional): Filter messages associated with a specific course.
  - `search` (`string`, optional): Search term matching subject, content, sender name, or course name.
  - `page` (`integer`, optional, default `1`): Page number.
  - `limit` (`integer`, optional, default `20`): Page size.
- **Headers**:
  - `x-user-id` (`uuid`, optional): User ID header alternative.
- **Responses**:
  - **`200 OK`**: Paginated messages list.
    ```json
    {
      "messages": [
        {
          "id": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c",
          "senderId": "5a205d7f-7084-4f91-ba7c-aeb0b6078256",
          "sender": {
            "id": "5a205d7f-7084-4f91-ba7c-aeb0b6078256",
            "name": "Dr. Sarah Jenkins",
            "email": "sarah.jenkins@university.edu",
            "role": "LECTURER"
          },
          "targetType": "BROADCAST",
          "courseId": "ffa88441-f78e-4e44-b110-6ab402f5cc10",
          "courseCode": "CS101",
          "courseName": "CS101: Introduction to Computer Science",
          "subject": "Midterm Review Session Scheduled",
          "snippet": "Hello everyone, please note that we will hold an extra review session this Thursday...",
          "content": "Hello everyone, please note that we will hold an extra review session this Thursday at 4 PM in Hall B.",
          "isPriority": true,
          "isRead": false,
          "readAt": null,
          "isArchived": false,
          "isSentByMe": false,
          "recipientCount": 24,
          "readCount": 18,
          "repliesCount": 3,
          "createdAt": "2026-08-04T10:00:00.000Z",
          "updatedAt": "2026-08-04T10:00:00.000Z"
        }
      ],
      "total": 1,
      "unreadCount": 1,
      "page": 1,
      "limit": 20
    }
    ```
  - **`400 Bad Request`**: Missing or invalid user ID.
  - **`404 Not Found`**: User not found.
  - **`500 Internal Server Error`**: Server error.

---

### `GET /api/messages/{id}`
Retrieves a single message along with its full chronological threaded replies and delivery statistics.

- **Tags**: `Messages`
- **Path Parameters**:
  - `id` (`uuid`, required): Message ID.
- **Query Parameters / Headers**:
  - `userId` / `x-user-id` (`uuid`, optional): Current user ID for personalization (`isMe`, `isSentByMe`, `isRead`).
- **Responses**:
  - **`200 OK`**: Message object with nested `replies`.
    ```json
    {
      "id": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c",
      "senderId": "5a205d7f-7084-4f91-ba7c-aeb0b6078256",
      "sender": {
        "id": "5a205d7f-7084-4f91-ba7c-aeb0b6078256",
        "name": "Dr. Sarah Jenkins",
        "email": "sarah.jenkins@university.edu",
        "role": "LECTURER"
      },
      "targetType": "BROADCAST",
      "courseId": "ffa88441-f78e-4e44-b110-6ab402f5cc10",
      "courseCode": "CS101",
      "courseName": "CS101: Introduction to Computer Science",
      "subject": "Midterm Review Session Scheduled",
      "snippet": "Hello everyone, please note that we will hold an extra review session...",
      "content": "Hello everyone, please note that we will hold an extra review session this Thursday at 4 PM in Hall B.",
      "isPriority": true,
      "isRead": true,
      "readAt": "2026-08-04T10:15:00.000Z",
      "isArchived": false,
      "isSentByMe": false,
      "recipientCount": 24,
      "readCount": 18,
      "repliesCount": 1,
      "createdAt": "2026-08-04T10:00:00.000Z",
      "updatedAt": "2026-08-04T10:00:00.000Z",
      "replies": [
        {
          "id": "d2e3f4a5-b6c7-8a9b-0c1d-2e3f4a5b6c7d",
          "messageId": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c",
          "senderId": "3a12e3cb-3b43-4461-b514-5404d55e3479",
          "sender": {
            "id": "3a12e3cb-3b43-4461-b514-5404d55e3479",
            "name": "John Doe",
            "email": "john.doe@student.university.edu",
            "role": "STUDENT"
          },
          "content": "Will the slides be recorded and uploaded afterwards?",
          "isMe": true,
          "createdAt": "2026-08-04T10:20:00.000Z"
        }
      ]
    }
    ```
  - **`400 Bad Request`**: Invalid message UUID format.
  - **`404 Not Found`**: Message not found.
  - **`500 Internal Server Error`**: Server error.

---

### `POST /api/messages`
Creates and dispatches a new direct message or course-wide announcement.

- **Tags**: `Messages`
- **Request Body**:
  ```json
  {
    "senderId": "5a205d7f-7084-4f91-ba7c-aeb0b6078256",
    "targetType": "BROADCAST",
    "courseId": "ffa88441-f78e-4e44-b110-6ab402f5cc10",
    "recipientId": "3a12e3cb-3b43-4461-b514-5404d55e3479",
    "subject": "Assignment 2 Clarification",
    "content": "Please review the updated submission guidelines regarding unit tests.",
    "isPriority": true
  }
  ```
- **Responses**:
  - **`201 Created`**: Message created.
  - **`400 Bad Request`**: Validation error (missing required fields, missing recipient for direct message, missing course for broadcast).
  - **`404 Not Found`**: Sender, recipient, or course not found.
  - **`500 Internal Server Error`**: Server error.

---

### `POST /api/messages/{id}/replies`
Appends a reply to an existing message thread.

- **Tags**: `Messages`
- **Path Parameters**:
  - `id` (`uuid`, required): Parent Message ID.
- **Request Body**:
  ```json
  {
    "senderId": "3a12e3cb-3b43-4461-b514-5404d55e3479",
    "content": "Thank you for the update!"
  }
  ```
- **Responses**:
  - **`201 Created`**: Returns created `MessageReply`.
  - **`400 Bad Request`**: Invalid input.
  - **`404 Not Found`**: Parent message or sender not found.
  - **`500 Internal Server Error`**: Server error.

---

### `PATCH /api/messages/{id}/read`
Updates read status for the calling user.

- **Tags**: `Messages`
- **Path Parameters**:
  - `id` (`uuid`, required): Message ID.
- **Request Body**:
  ```json
  {
    "userId": "3a12e3cb-3b43-4461-b514-5404d55e3479",
    "isRead": true
  }
  ```
- **Responses**:
  - **`200 OK`**: `{ "success": true, "messageId": "...", "isRead": true, "readAt": "..." }`
  - **`400 Bad Request`**: Invalid ID or missing user ID.
  - **`404 Not Found`**: Message or recipient entry not found.
  - **`500 Internal Server Error`**: Server error.

---

### `PATCH /api/messages/{id}/archive`
Archives or unarchives a message in the user's view.

- **Tags**: `Messages`
- **Path Parameters**:
  - `id` (`uuid`, required): Message ID.
- **Request Body**:
  ```json
  {
    "userId": "3a12e3cb-3b43-4461-b514-5404d55e3479",
    "isArchived": true
  }
  ```
- **Responses**:
  - **`200 OK`**: `{ "success": true, "messageId": "...", "isArchived": true }`
  - **`400 Bad Request`**: Invalid ID or missing user ID.
  - **`404 Not Found`**: Message or recipient entry not found.
  - **`500 Internal Server Error`**: Server error.

---

### `DELETE /api/messages/{id}`
Soft-deletes a message from the user's inbox or sent folder.

- **Tags**: `Messages`
- **Path Parameters**:
  - `id` (`uuid`, required): Message ID.
- **Query Parameters / Headers / Body**:
  - `userId` (`uuid`): User ID.
- **Responses**:
  - **`200 OK`**: `{ "success": true, "message": "Message removed from inbox" }`
  - **`400 Bad Request`**: Missing user ID.
  - **`404 Not Found`**: Message not found.
  - **`500 Internal Server Error`**: Server error.

---

### `GET /api/messages/unread-count` and `GET /api/users/{userId}/messages/unread-count`
Fast unread messages count for navbar notification badges.

- **Tags**: `Messages`
- **Parameters**: `userId` via path or query or `x-user-id` header.
- **Responses**:
  - **`200 OK`**: `{ "unreadCount": 3 }`
  - **`400 Bad Request`**: Missing user ID.
  - **`500 Internal Server Error`**: Server error.


