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
    ErrorResponse: {
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
        studentsCount: {
          type: "integer",
          minimum: 0,
          description: "Number of active enrolled students in the course",
        },
        openAssignmentsCount: {
          type: "integer",
          minimum: 0,
          description: "Number of unsubmitted published assignments in the course for the requesting student",
        },
        nextDueAt: {
          type: ["string", "null"],
          format: "date-time",
          description: "Earliest upcoming due date among unsubmitted assignments",
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
            course: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                name: { type: "string" },
                semester: { type: "string" },
                academicYear: { type: "integer" },
              },
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
      ],
    },
    StudentAssignmentEvaluation: {
      type: "object",
      required: ["id", "maxScore", "status", "isFinal"],
      properties: {
        id: { type: "string", format: "uuid" },
        score: { type: ["number", "null"] },
        maxScore: { type: "number" },
        feedback: { type: ["string", "null"] },
        status: {
          type: "string",
          enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
        },
        isFinal: { type: "boolean" },
        evaluatedAt: { type: ["string", "null"], format: "date-time" },
      },
    },
    StudentAssignmentFile: {
      type: "object",
      required: ["id", "name", "sizeBytes", "mimeType"],
      properties: {
        id: { type: "string", format: "uuid" },
        name: { type: "string" },
        sizeBytes: { type: "integer" },
        mimeType: { type: "string" },
        downloadUrl: { type: "string" },
      },
    },
    StudentAssignmentSubmission: {
      type: "object",
      required: ["id", "attemptNumber", "status"],
      properties: {
        id: { type: "string", format: "uuid" },
        attemptNumber: { type: "integer", minimum: 1 },
        status: { type: "string", enum: ["DRAFT", "SUBMITTED"] },
        submittedAt: { type: ["string", "null"], format: "date-time" },
        evaluation: {
          type: ["object", "null"],
          $ref: "#/components/schemas/StudentAssignmentEvaluation",
        },
      },
    },
    StudentAssignmentDetailSubmission: {
      type: "object",
      required: ["id", "attemptNumber", "status", "files"],
      properties: {
        id: { type: "string", format: "uuid" },
        attemptNumber: { type: "integer", minimum: 1 },
        status: { type: "string", enum: ["DRAFT", "SUBMITTED"] },
        submittedAt: { type: ["string", "null"], format: "date-time" },
        files: {
          type: "array",
          items: { $ref: "#/components/schemas/StudentAssignmentFile" },
        },
        evaluation: {
          type: ["object", "null"],
          $ref: "#/components/schemas/StudentAssignmentEvaluation",
        },
      },
    },
    StudentAssignmentAppeal: {
      type: "object",
      required: ["id", "status", "reason", "createdAt"],
      properties: {
        id: { type: "string", format: "uuid" },
        status: {
          type: "string",
          enum: [
            "SUBMITTED",
            "UNDER_REVIEW",
            "ACCEPTED",
            "REJECTED",
            "CANCELLED",
          ],
        },
        reason: { type: "string" },
        resolution: { type: ["string", "null"] },
        resolvedAt: { type: ["string", "null"], format: "date-time" },
        createdAt: { type: "string", format: "date-time" },
      },
    },
    StudentAssignment: {
      allOf: [
        { $ref: "#/components/schemas/Assignment" },
        {
          type: "object",
          required: ["studentStatus"],
          properties: {
            studentStatus: {
              type: "string",
              enum: ["NOT_STARTED", "DRAFT", "SUBMITTED", "GRADED", "OVERDUE"],
            },
            submission: {
              type: ["object", "null"],
              $ref: "#/components/schemas/StudentAssignmentSubmission",
            },
          },
        },
      ],
    },
    StudentAssignmentDetail: {
      allOf: [
        { $ref: "#/components/schemas/Assignment" },
        {
          type: "object",
          required: ["studentStatus"],
          properties: {
            studentStatus: {
              type: "string",
              enum: ["NOT_STARTED", "DRAFT", "SUBMITTED", "GRADED", "OVERDUE"],
            },
            submission: {
              type: ["object", "null"],
              $ref: "#/components/schemas/StudentAssignmentDetailSubmission",
            },
            appeal: {
              type: ["object", "null"],
              $ref: "#/components/schemas/StudentAssignmentAppeal",
            },
          },
        },
      ],
    },
    AppealFile: {
      type: "object",
      properties: {
        appealId: { type: "string", format: "uuid" },
        fileId: { type: "string", format: "uuid" },
        file: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            originalName: { type: "string" },
            mimeType: { type: "string" },
            sizeBytes: { type: "integer" },
            s3Key: { type: "string" },
          },
        },
      },
    },
    AppealCourse: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        name: { type: "string" },
        semester: { type: "string" },
        academicYear: { type: "integer" },
      },
    },
    AppealAssignment: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        name: { type: "string" },
        maxScore: { type: "number" },
        courseId: { type: "string", format: "uuid" },
        course: { $ref: "#/components/schemas/AppealCourse" },
      },
    },
    AppealSubmission: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        attemptNumber: { type: "integer" },
        status: { type: "string", enum: ["DRAFT", "SUBMITTED"] },
        submittedAt: { type: ["string", "null"], format: "date-time" },
        assignment: { $ref: "#/components/schemas/AppealAssignment" },
      },
    },
    AppealEvaluation: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        score: { type: ["number", "null"] },
        maxScore: { type: "number" },
        feedback: { type: ["string", "null"] },
        status: {
          type: "string",
          enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
        },
        isFinal: { type: "boolean" },
      },
    },
    Appeal: {
      type: "object",
      required: [
        "id",
        "submissionId",
        "evaluationId",
        "studentId",
        "reason",
        "status",
        "createdAt",
        "updatedAt",
      ],
      properties: {
        id: { type: "string", format: "uuid" },
        submissionId: { type: "string", format: "uuid" },
        evaluationId: { type: "string", format: "uuid" },
        studentId: { type: "string", format: "uuid" },
        reviewerId: { type: ["string", "null"], format: "uuid" },
        reason: { type: "string" },
        status: {
          type: "string",
          enum: [
            "SUBMITTED",
            "UNDER_REVIEW",
            "ACCEPTED",
            "REJECTED",
            "CANCELLED",
          ],
        },
        resolution: { type: ["string", "null"] },
        resolvedAt: { type: ["string", "null"], format: "date-time" },
        submission: { $ref: "#/components/schemas/AppealSubmission" },
        student: {
          type: "object",
          properties: {
            userId: { type: "string", format: "uuid" },
            user: { $ref: "#/components/schemas/User" },
          },
        },
        evaluation: { $ref: "#/components/schemas/AppealEvaluation" },
        reviewer: {
          type: ["object", "null"],
          $ref: "#/components/schemas/Lecturer",
        },
        files: {
          type: "array",
          items: { $ref: "#/components/schemas/AppealFile" },
        },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
      },
    },
    LecturerAppealsStats: {
      type: "object",
      required: ["pendingCount", "resolvedCount", "totalCount"],
      properties: {
        pendingCount: { type: "integer" },
        resolvedCount: { type: "integer" },
        totalCount: { type: "integer" },
      },
    },
    ResolveAppealRequest: {
      type: "object",
      required: ["status", "resolution", "reviewerId"],
      properties: {
        status: {
          type: "string",
          enum: ["ACCEPTED", "REJECTED"],
        },
        resolution: { type: "string" },
        reviewerId: { type: "string", format: "uuid" },
        newScore: { type: "number", minimum: 0 },
      },
    },
    Notification: {
      type: "object",
      required: [
        "id",
        "recipientId",
        "title",
        "body",
        "category",
        "isRead",
        "createdAt",
        "updatedAt",
      ],
      properties: {
        id: { type: "string", format: "uuid" },
        recipientId: { type: "string", format: "uuid" },
        title: { type: "string" },
        body: { type: "string" },
        category: {
          type: "string",
          enum: [
            "ASSIGNMENT",
            "GRADE",
            "APPEAL",
            "WARNING",
            "SYSTEM",
            "INFO",
          ],
        },
        isRead: { type: "boolean" },
        link: { type: ["string", "null"] },
        metadata: { type: ["object", "null"] },
        readAt: { type: ["string", "null"], format: "date-time" },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
      },
    },
    UnreadCountResponse: {
      type: "object",
      required: ["unreadCount"],
      properties: {
        unreadCount: { type: "integer" },
      },
    },
    MessageSender: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        name: { type: "string" },
        email: { type: "string" },
        role: { type: "string", enum: ["STUDENT", "LECTURER", "ADMIN"] },
      },
    },
    MessageReply: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        messageId: { type: "string", format: "uuid" },
        senderId: { type: "string", format: "uuid" },
        sender: { $ref: "#/components/schemas/MessageSender" },
        content: { type: "string" },
        isMe: { type: "boolean" },
        createdAt: { type: "string", format: "date-time" },
      },
    },
    MessageSummary: {
      type: "object",
      required: [
        "id",
        "senderId",
        "targetType",
        "subject",
        "content",
        "snippet",
        "isPriority",
        "isRead",
        "isArchived",
        "isSentByMe",
        "recipientCount",
        "readCount",
        "repliesCount",
        "createdAt",
        "updatedAt",
      ],
      properties: {
        id: { type: "string", format: "uuid" },
        senderId: { type: "string", format: "uuid" },
        sender: { $ref: "#/components/schemas/MessageSender" },
        targetType: {
          type: "string",
          enum: ["DIRECT", "BROADCAST", "SYSTEM"],
        },
        courseId: { type: ["string", "null"], format: "uuid" },
        courseCode: { type: ["string", "null"] },
        courseName: { type: ["string", "null"] },
        subject: { type: "string" },
        snippet: { type: "string" },
        content: { type: "string" },
        isPriority: { type: "boolean" },
        isRead: { type: "boolean" },
        readAt: { type: ["string", "null"], format: "date-time" },
        isArchived: { type: "boolean" },
        isSentByMe: { type: "boolean" },
        recipientCount: { type: "integer" },
        readCount: { type: "integer" },
        repliesCount: { type: "integer" },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
      },
    },
    Message: {
      allOf: [
        { $ref: "#/components/schemas/MessageSummary" },
        {
          type: "object",
          properties: {
            replies: {
              type: "array",
              items: { $ref: "#/components/schemas/MessageReply" },
            },
          },
        },
      ],
    },
    CreateMessageRequest: {
      type: "object",
      required: ["senderId", "subject", "content"],
      properties: {
        senderId: { type: "string", format: "uuid" },
        targetType: {
          type: "string",
          enum: ["DIRECT", "BROADCAST", "SYSTEM"],
          default: "DIRECT",
        },
        courseId: { type: "string", format: "uuid" },
        recipientId: { type: "string", format: "uuid" },
        subject: { type: "string" },
        content: { type: "string" },
        isPriority: { type: "boolean", default: false },
      },
    },
    CreateReplyRequest: {
      type: "object",
      required: ["senderId", "content"],
      properties: {
        senderId: { type: "string", format: "uuid" },
        content: { type: "string" },
      },
    },
    MessageUnreadCountResponse: {
      type: "object",
      required: ["unreadCount"],
      properties: {
        unreadCount: { type: "integer" },
      },
    },
    LecturerDashboardKpis: {
      type: "object",
      required: [
        "activeCourses",
        "pendingAppeals",
        "readyToPublish",
        "averageScore",
      ],
      properties: {
        activeCourses: { type: "integer" },
        pendingAppeals: { type: "integer" },
        readyToPublish: { type: "integer" },
        averageScore: { type: "number" },
      },
    },
    RequiresAttentionItem: {
      type: "object",
      required: [
        "id",
        "type",
        "title",
        "subtitle",
        "actionText",
        "actionHref",
        "accentColor",
      ],
      properties: {
        id: { type: "string" },
        type: { type: "string", enum: ["appeal", "ai-grading", "deadline"] },
        title: { type: "string" },
        subtitle: { type: "string" },
        actionText: { type: "string" },
        actionHref: { type: "string" },
        accentColor: { type: "string" },
      },
    },
    GradeDistributionRange: {
      type: "object",
      required: ["rangeKey", "label", "count", "color", "darkColor"],
      properties: {
        rangeKey: { type: "string" },
        label: { type: "string" },
        count: { type: "integer" },
        color: { type: "string" },
        darkColor: { type: "string" },
      },
    },
    GradeDistributionCourseData: {
      type: "object",
      required: [
        "courseId",
        "courseName",
        "average",
        "median",
        "passRate",
        "totalStudents",
        "data",
      ],
      properties: {
        courseId: { type: "string" },
        code: { type: "string" },
        courseName: { type: "string" },
        average: { type: "number" },
        median: { type: "number" },
        passRate: { type: "number" },
        totalStudents: { type: "integer" },
        data: {
          type: "array",
          items: { $ref: "#/components/schemas/GradeDistributionRange" },
        },
      },
    },
    GradeDistributionData: {
      type: "object",
      required: ["all", "byCourse"],
      properties: {
        all: { $ref: "#/components/schemas/GradeDistributionCourseData" },
        byCourse: {
          type: "array",
          items: { $ref: "#/components/schemas/GradeDistributionCourseData" },
        },
      },
    },
    AssignmentCompletionItem: {
      type: "object",
      required: [
        "assignmentId",
        "name",
        "code",
        "graded",
        "aiChecking",
        "submitted",
        "missing",
        "total",
      ],
      properties: {
        assignmentId: { type: "string", format: "uuid" },
        name: { type: "string" },
        code: { type: "string" },
        graded: { type: "integer" },
        aiChecking: { type: "integer" },
        submitted: { type: "integer" },
        missing: { type: "integer" },
        total: { type: "integer" },
      },
    },
    DashboardCourseItem: {
      type: "object",
      required: [
        "id",
        "name",
        "code",
        "studentsCount",
        "activeAssignments",
        "academicYear",
        "semester",
      ],
      properties: {
        id: { type: "string", format: "uuid" },
        name: { type: "string" },
        code: { type: "string" },
        studentsCount: { type: "integer" },
        activeAssignments: { type: "integer" },
        academicYear: { type: "integer" },
        semester: { type: "string" },
      },
    },
    LecturerDashboardResponse: {
      type: "object",
      required: [
        "kpis",
        "requiresAttention",
        "gradeDistribution",
        "assignmentCompletion",
        "recentCourses",
      ],
      properties: {
        kpis: { $ref: "#/components/schemas/LecturerDashboardKpis" },
        requiresAttention: {
          type: "array",
          items: { $ref: "#/components/schemas/RequiresAttentionItem" },
        },
        gradeDistribution: {
          $ref: "#/components/schemas/GradeDistributionData",
        },
        assignmentCompletion: {
          type: "array",
          items: { $ref: "#/components/schemas/AssignmentCompletionItem" },
        },
        recentCourses: {
          type: "array",
          items: { $ref: "#/components/schemas/DashboardCourseItem" },
        },
      },
    },
    LecturerAssignmentStats: {
      type: "object",
      required: [
        "totalStudents",
        "submitted",
        "missing",
        "graded",
        "evaluating",
        "appealsCount",
        "averageScore",
        "submissionRate",
        "remainingHours",
      ],
      properties: {
        totalStudents: { type: "integer", example: 120 },
        submitted: { type: "integer", example: 85 },
        missing: { type: "integer", example: 35 },
        graded: { type: "integer", example: 75 },
        evaluating: { type: "integer", example: 10 },
        appealsCount: { type: "integer", example: 3 },
        averageScore: { type: "number", example: 88.4 },
        submissionRate: { type: "number", example: 71 },
        remainingHours: { type: "integer", nullable: true, example: 144 },
      },
    },
    LecturerAssignmentCourseInfo: {
      type: "object",
      required: ["id", "name", "code", "semester", "academicYear"],
      properties: {
        id: { type: "string", format: "uuid" },
        name: { type: "string", example: "CS101: Data Structures" },
        code: { type: "string", example: "CS101" },
        semester: { type: "string", example: "Fall 2026" },
        academicYear: { type: "integer", example: 2026 },
      },
    },
    LecturerAssignmentStudentInfo: {
      type: "object",
      required: ["userId", "name", "email"],
      properties: {
        userId: { type: "string", format: "uuid" },
        name: { type: "string", example: "Yossi Cohen" },
        email: { type: "string", format: "email", example: "yossi@example.com" },
        studentNumber: { type: "string", example: "204918231" },
      },
    },
    LecturerAssignmentSubmissionInfo: {
      type: "object",
      required: ["id", "attemptNumber", "submittedAt", "filesCount"],
      properties: {
        id: { type: "string", format: "uuid" },
        attemptNumber: { type: "integer", example: 1 },
        submittedAt: { type: "string", format: "date-time", nullable: true },
        filesCount: { type: "integer", example: 2 },
      },
    },
    LecturerAssignmentEvaluationInfo: {
      type: "object",
      required: [
        "id",
        "score",
        "maxScore",
        "percentage",
        "isFinal",
        "evaluatedAt",
      ],
      properties: {
        id: { type: "string", format: "uuid" },
        score: { type: "number", example: 95 },
        maxScore: { type: "number", example: 100 },
        percentage: { type: "number", example: 95 },
        isFinal: { type: "boolean", example: true },
        feedback: { type: "string", nullable: true },
        evaluatedAt: { type: "string", format: "date-time" },
      },
    },
    LecturerAssignmentAppealInfo: {
      type: "object",
      required: ["id", "status", "reason", "createdAt"],
      properties: {
        id: { type: "string", format: "uuid" },
        status: {
          type: "string",
          enum: ["SUBMITTED", "UNDER_REVIEW", "ACCEPTED", "REJECTED"],
          example: "SUBMITTED",
        },
        reason: { type: "string" },
        createdAt: { type: "string", format: "date-time" },
      },
    },
    LecturerAssignmentStudentItem: {
      type: "object",
      required: ["student", "status", "submission", "evaluation", "appeal"],
      properties: {
        student: { $ref: "#/components/schemas/LecturerAssignmentStudentInfo" },
        status: {
          type: "string",
          enum: [
            "NOT_STARTED",
            "SUBMITTED",
            "EVALUATING",
            "GRADED",
            "OVERDUE",
            "APPEAL",
          ],
          example: "GRADED",
        },
        submission: {
          $ref: "#/components/schemas/LecturerAssignmentSubmissionInfo",
          nullable: true,
        },
        evaluation: {
          $ref: "#/components/schemas/LecturerAssignmentEvaluationInfo",
          nullable: true,
        },
        appeal: {
          $ref: "#/components/schemas/LecturerAssignmentAppealInfo",
          nullable: true,
        },
      },
    },
    LecturerAssignmentOverviewResponse: {
      type: "object",
      required: [
        "id",
        "courseId",
        "name",
        "description",
        "type",
        "evaluationInstructions",
        "maxScore",
        "status",
        "startAt",
        "dueAt",
        "createdAt",
        "updatedAt",
        "course",
        "stats",
        "students",
      ],
      properties: {
        id: { type: "string", format: "uuid" },
        courseId: { type: "string", format: "uuid" },
        name: { type: "string", example: "Homework 3: Binary Search Trees" },
        description: { type: "string" },
        type: { type: "string", example: "file" },
        evaluationInstructions: { type: "string" },
        maxScore: { type: "number", example: 100 },
        status: {
          type: "string",
          enum: ["DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"],
          example: "PUBLISHED",
        },
        startAt: { type: "string", format: "date-time", nullable: true },
        dueAt: { type: "string", format: "date-time", nullable: true },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
        course: { $ref: "#/components/schemas/LecturerAssignmentCourseInfo" },
        stats: { $ref: "#/components/schemas/LecturerAssignmentStats" },
        students: {
          type: "array",
          items: {
            $ref: "#/components/schemas/LecturerAssignmentStudentItem",
          },
        },
      },
    },
  },
} as const;



