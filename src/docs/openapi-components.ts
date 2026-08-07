export const openApiComponents = {
  securitySchemes: {
    ltiToken: {
      type: "apiKey",
      in: "query",
      name: "ltik",
      description: "Token issued by ltijs after an LTI launch.",
    },
  },
  schemas: {
    Error: {
      type: "object",
      required: ["message"],
      properties: {
        message: { type: "string" },
      },
    },
    CreateUserRequest: {
      type: "object",
      required: ["name", "email"],
      properties: {
        name: { type: "string", minLength: 1 },
        email: { type: "string", format: "email" },
      },
    },
    User: {
      type: "object",
      required: ["id", "name", "role"],
      properties: {
        id: { type: "string", format: "uuid" },
        name: { type: "string" },
        email: { type: ["string", "null"], format: "email" },
        role: { type: "string", enum: ["STUDENT", "LECTURER"] },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
      },
    },
    Student: {
      type: "object",
      required: ["userId", "user"],
      properties: {
        userId: { type: "string", format: "uuid" },
        user: { $ref: "#/components/schemas/User" },
      },
    },
    Lecturer: {
      type: "object",
      required: ["userId", "user"],
      properties: {
        userId: { type: "string", format: "uuid" },
        user: { $ref: "#/components/schemas/User" },
      },
    },
    CourseLecturer: {
      type: "object",
      properties: {
        courseId: { type: "string", format: "uuid" },
        lecturerId: { type: "string", format: "uuid" },
        permissionLevel: {
          type: "string",
          enum: ["OWNER", "EDITOR"],
        },
        lecturer: { $ref: "#/components/schemas/Lecturer" },
        assignedAt: { type: "string", format: "date-time" },
      },
    },
    CreateCourseRequest: {
      type: "object",
      required: ["name", "semester", "academicYear", "lecturerIds"],
      properties: {
        name: { type: "string", minLength: 1 },
        semester: { type: "string", minLength: 1 },
        academicYear: {
          type: "integer",
          minimum: 0,
          maximum: 32767,
        },
        lecturerIds: {
          type: "array",
          minItems: 1,
          uniqueItems: true,
          items: { type: "string", format: "uuid" },
        },
      },
    },
    Course: {
      type: "object",
      required: ["id", "name", "semester", "academicYear"],
      properties: {
        id: { type: "string", format: "uuid" },
        name: { type: "string" },
        semester: { type: "string" },
        academicYear: { type: "integer" },
        lecturers: {
          type: "array",
          items: { $ref: "#/components/schemas/CourseLecturer" },
        },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
      },
    },
    CreateAssignmentRequest: {
      type: "object",
      required: [
        "name",
        "description",
        "type",
        "evaluationInstructions",
        "maxScore",
      ],
      properties: {
        name: { type: "string", minLength: 1 },
        description: { type: "string" },
        type: { type: "string", minLength: 1 },
        evaluationInstructions: { type: "string" },
        maxScore: { type: "number", exclusiveMinimum: 0 },
        startAt: { type: ["string", "null"], format: "date-time" },
        dueAt: { type: ["string", "null"], format: "date-time" },
        status: {
          type: "string",
          enum: ["DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"],
          default: "DRAFT",
        },
      },
    },
    Assignment: {
      allOf: [
        { $ref: "#/components/schemas/CreateAssignmentRequest" },
        {
          type: "object",
          required: ["id", "courseId", "status"],
          properties: {
            id: { type: "string", format: "uuid" },
            courseId: { type: "string", format: "uuid" },
            questionSelectionInstructions: { type: ["string", "null"] },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
      ],
    },
    AssignmentQuestion: {
      type: "object",
      required: [
        "id",
        "assignmentId",
        "questionKey",
        "orderIndex",
        "prompt",
        "maxScore",
        "source",
      ],
      properties: {
        id: { type: "string", format: "uuid" },
        assignmentId: { type: "string", format: "uuid" },
        questionSetId: { type: "string", format: "uuid" },
        isActive: { type: "boolean" },
        questionKey: { type: "string" },
        orderIndex: { type: "integer", minimum: 0 },
        prompt: { type: "string" },
        rubric: { type: ["string", "null"] },
        maxScore: { type: "number", exclusiveMinimum: 0 },
        source: {
          type: "string",
          enum: ["MANUAL", "DOCUMENT_IMPORT"],
        },
        importId: { type: ["string", "null"], format: "uuid" },
      },
    },
    ReplaceQuestionsRequest: {
      type: "object",
      required: ["questions"],
      properties: {
        questions: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            required: ["questionKey", "orderIndex", "prompt", "maxScore"],
            properties: {
              questionKey: { type: "string", minLength: 1 },
              orderIndex: { type: "integer", minimum: 0 },
              prompt: { type: "string", minLength: 1 },
              rubric: { type: ["string", "null"] },
              maxScore: { type: "number", exclusiveMinimum: 0 },
            },
          },
        },
      },
    },
    QuestionImportAccepted: {
      type: "object",
      required: ["importId", "status", "assignmentId", "fileId"],
      properties: {
        importId: { type: "string", format: "uuid" },
        status: {
          type: "string",
          enum: [
            "PENDING",
            "PROCESSING",
            "COMPLETED",
            "FAILED",
            "SUPERSEDED",
          ],
        },
        assignmentId: { type: "string", format: "uuid" },
        fileId: { type: "string", format: "uuid" },
      },
    },
    Submission: {
      type: "object",
      required: [
        "id",
        "assignmentId",
        "studentId",
        "attemptNumber",
        "status",
      ],
      properties: {
        id: { type: "string", format: "uuid" },
        assignmentId: { type: "string", format: "uuid" },
        studentId: { type: "string", format: "uuid" },
        attemptNumber: { type: "integer", minimum: 1 },
        answerText: { type: ["string", "null"] },
        status: { type: "string", enum: ["DRAFT", "SUBMITTED"] },
        submittedAt: { type: ["string", "null"], format: "date-time" },
      },
    },
    EvaluationQuestionResult: {
      type: "object",
      required: [
        "questionId",
        "score",
        "maxScore",
        "isAnswered",
        "countsTowardTotal",
        "selectionReason",
        "feedback",
      ],
      properties: {
        id: { type: "string", format: "uuid" },
        questionId: { type: "string", format: "uuid" },
        questionKey: { type: ["string", "null"] },
        orderIndex: { type: ["integer", "null"] },
        prompt: { type: ["string", "null"] },
        score: { type: "number" },
        maxScore: { type: "number" },
        isAnswered: { type: "boolean" },
        countsTowardTotal: { type: "boolean" },
        selectionReason: { type: "string" },
        feedback: { type: "string" },
        evidence: { type: ["string", "null"] },
        confidence: { type: ["number", "null"] },
      },
    },
    Evaluation: {
      type: "object",
      required: ["id", "submissionId", "status", "maxScore"],
      properties: {
        id: { type: "string", format: "uuid" },
        submissionId: { type: "string", format: "uuid" },
        questionSetId: { type: "string", format: "uuid" },
        status: {
          type: "string",
          enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
        },
        score: { type: ["number", "null"] },
        maxScore: { type: "number" },
        feedback: { type: ["string", "null"] },
        selectionSummary: { type: ["string", "null"] },
        confidence: { type: ["number", "null"] },
        model: { type: "string" },
        promptVersion: { type: "string" },
        isFinal: { type: "boolean" },
        errorMessage: { type: ["string", "null"] },
        questionResults: {
          type: "array",
          items: { $ref: "#/components/schemas/EvaluationQuestionResult" },
        },
      },
    },
  },
} as const;
