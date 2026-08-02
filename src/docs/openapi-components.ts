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
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
      ],
    },
  },
} as const;
