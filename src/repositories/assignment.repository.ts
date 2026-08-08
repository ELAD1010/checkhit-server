import { DataSource, In } from "typeorm";
import { AppDataSource } from "../database/data-source.js";
import { Appeal } from "../entities/appeal.js";
import { Assignment } from "../entities/assignment.js";
import { Course } from "../entities/course.js";
import { Student } from "../entities/student.js";
import { Enrollment } from "../entities/enrollment.js";
import { Submission } from "../entities/submission.js";
import {
  AppealStatus,
  AssignmentStatus,
  EvaluationStatus,
  MembershipStatus,
  SubmissionStatus,
} from "../entities/enums.js";

export type CreateAssignmentInput = {
  courseId: string;
  name: string;
  description: string;
  type: string;
  evaluationInstructions: string;
  maxScore: number;
  startAt?: Date | null;
  dueAt?: Date | null;
  status?: AssignmentStatus;
};

export type StudentAssignmentStatus =
  | "NOT_STARTED"
  | "DRAFT"
  | "SUBMITTED"
  | "GRADED"
  | "OVERDUE";

export type StudentAssignmentEvaluationSummary = {
  id: string;
  score: number | null;
  maxScore: number;
  feedback: string | null;
  status: EvaluationStatus;
  isFinal: boolean;
  evaluatedAt?: Date | null;
};

export type StudentAssignmentFileSummary = {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
};

export type StudentAssignmentSubmissionSummary = {
  id: string;
  attemptNumber: number;
  status: SubmissionStatus;
  submittedAt: Date | null;
  evaluation: StudentAssignmentEvaluationSummary | null;
};

export type StudentAssignmentDetailSubmission = {
  id: string;
  attemptNumber: number;
  status: SubmissionStatus;
  submittedAt: Date | null;
  files: StudentAssignmentFileSummary[];
  evaluation: StudentAssignmentEvaluationSummary | null;
};

export type StudentAssignmentAppealSummary = {
  id: string;
  status: AppealStatus;
  reason: string;
  resolution: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
};

export type StudentAssignmentResult = Assignment & {
  studentStatus: StudentAssignmentStatus;
  submission: StudentAssignmentSubmissionSummary | null;
};

export type StudentAssignmentDetailResult = Assignment & {
  studentStatus: StudentAssignmentStatus;
  submission: StudentAssignmentDetailSubmission | null;
  appeal: StudentAssignmentAppealSummary | null;
};

export interface StudentAssignmentsQueryOptions {
  limit?: number;
  status?: string;
  upcoming?: boolean;
  sort?: string;
}

export class AssignmentNotFoundError extends Error {
  constructor(readonly assignmentId: string) {
    super(`Assignment not found: ${assignmentId}`);
    this.name = "AssignmentNotFoundError";
  }
}

export class AssignmentCourseNotFoundError extends Error {
  constructor(readonly courseId: string) {
    super(`Course not found: ${courseId}`);
    this.name = "AssignmentCourseNotFoundError";
  }
}

export class AssignmentStudentNotFoundError extends Error {
  constructor(readonly studentId: string) {
    super(`Student not found: ${studentId}`);
    this.name = "AssignmentStudentNotFoundError";
  }
}

export class StudentNotEnrolledInCourseError extends Error {
  constructor(
    readonly studentId: string,
    readonly courseId: string,
  ) {
    super(`Student ${studentId} is not enrolled in course ${courseId}`);
    this.name = "StudentNotEnrolledInCourseError";
  }
}

export type LecturerAssignmentStats = {
  totalStudents: number;
  submitted: number;
  missing: number;
  graded: number;
  evaluating: number;
  appealsCount: number;
  averageScore: number;
  submissionRate: number;
  remainingHours: number | null;
};

export type LecturerAssignmentStudentInfo = {
  userId: string;
  name: string;
  email: string;
  studentNumber?: string;
};

export type LecturerAssignmentSubmissionInfo = {
  id: string;
  attemptNumber: number;
  submittedAt: Date | null;
  filesCount: number;
};

export type LecturerAssignmentEvaluationInfo = {
  id: string;
  score: number;
  maxScore: number;
  percentage: number;
  isFinal: boolean;
  feedback?: string | null;
  evaluatedAt: Date | null;
};

export type LecturerAssignmentAppealInfo = {
  id: string;
  status: AppealStatus;
  reason: string;
  createdAt: Date;
};

export type LecturerAssignmentStudentStatus =
  | "NOT_STARTED"
  | "SUBMITTED"
  | "EVALUATING"
  | "GRADED"
  | "OVERDUE"
  | "APPEAL";

export type LecturerAssignmentStudentItem = {
  student: LecturerAssignmentStudentInfo;
  status: LecturerAssignmentStudentStatus;
  submission: LecturerAssignmentSubmissionInfo | null;
  evaluation: LecturerAssignmentEvaluationInfo | null;
  appeal: LecturerAssignmentAppealInfo | null;
};

export type LecturerAssignmentCourseInfo = {
  id: string;
  name: string;
  code: string;
  semester: string;
  academicYear: number;
};

export type LecturerAssignmentOverviewResponse = {
  id: string;
  courseId: string;
  name: string;
  description: string;
  type: string;
  evaluationInstructions: string;
  maxScore: number;
  status: AssignmentStatus;
  startAt: Date | null;
  dueAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  course: LecturerAssignmentCourseInfo;
  stats: LecturerAssignmentStats;
  students: LecturerAssignmentStudentItem[];
};

export interface LecturerAssignmentOverviewOptions {
  search?: string;
  status?: string;
}

export class AssignmentRepository {
  constructor(private readonly dataSource: DataSource = AppDataSource) {}

  async createAssignment(input: CreateAssignmentInput): Promise<Assignment> {
    const courseExists = await this.dataSource
      .getRepository(Course)
      .existsBy({ id: input.courseId });

    if (!courseExists) {
      throw new AssignmentCourseNotFoundError(input.courseId);
    }

    const assignmentRepository = this.dataSource.getRepository(Assignment);
    return assignmentRepository.save(
      assignmentRepository.create({
        courseId: input.courseId,
        name: input.name,
        description: input.description,
        type: input.type,
        evaluationInstructions: input.evaluationInstructions,
        questionSelectionInstructions: null,
        maxScore: input.maxScore,
        startAt: input.startAt ?? null,
        dueAt: input.dueAt ?? null,
        status: input.status ?? AssignmentStatus.DRAFT,
        ltiResourceLinkId: null,
        ltiLineItemUrl: null,
      }),
    );
  }

  async findAssignmentById(assignmentId: string): Promise<Assignment | null> {
    return this.dataSource.getRepository(Assignment).findOne({
      where: { id: assignmentId },
      relations: { course: true },
    });
  }

  async findStudentAssignmentDetail(
    assignmentId: string,
    studentId: string,
  ): Promise<StudentAssignmentDetailResult | null> {
    const studentExists = await this.dataSource
      .getRepository(Student)
      .existsBy({ userId: studentId });

    if (!studentExists) {
      throw new AssignmentStudentNotFoundError(studentId);
    }

    const assignment = await this.dataSource.getRepository(Assignment).findOne({
      where: { id: assignmentId },
      relations: { course: true },
    });

    if (!assignment) {
      return null;
    }

    const submission = await this.dataSource.getRepository(Submission).findOne({
      where: {
        studentId,
        assignmentId,
      },
      relations: {
        evaluations: true,
        files: {
          file: true,
        },
        appeals: true,
      },
      order: {
        attemptNumber: "DESC",
      },
    });

    let studentStatus: StudentAssignmentStatus = "NOT_STARTED";
    let submissionDetail: StudentAssignmentDetailSubmission | null = null;
    let appealDetail: StudentAssignmentAppealSummary | null = null;

    if (submission) {
      let evaluationSummary: StudentAssignmentEvaluationSummary | null = null;
      const finalEval =
        submission.evaluations?.find(
          (e) => e.isFinal && e.status === EvaluationStatus.COMPLETED,
        ) ||
        submission.evaluations?.find(
          (e) => e.status === EvaluationStatus.COMPLETED,
        );

      if (finalEval) {
        evaluationSummary = {
          id: finalEval.id,
          score: finalEval.score,
          maxScore: finalEval.maxScore,
          feedback: finalEval.feedback,
          status: finalEval.status,
          isFinal: finalEval.isFinal,
          evaluatedAt: finalEval.completedAt,
        };
      }

      const filesSummary: StudentAssignmentFileSummary[] =
        submission.files?.map((sf) => ({
          id: sf.file.id,
          name: sf.file.originalName,
          sizeBytes: Number(sf.file.sizeBytes),
          mimeType: sf.file.mimeType,
        })) || [];

      submissionDetail = {
        id: submission.id,
        attemptNumber: submission.attemptNumber,
        status: submission.status,
        submittedAt: submission.submittedAt,
        files: filesSummary,
        evaluation: evaluationSummary,
      };

      if (evaluationSummary) {
        studentStatus = "GRADED";
      } else if (submission.status === SubmissionStatus.SUBMITTED) {
        studentStatus = "SUBMITTED";
      } else {
        studentStatus = "DRAFT";
      }

      if (submission.appeals && submission.appeals.length > 0) {
        const sortedAppeals = [...submission.appeals].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        const latestAppeal = sortedAppeals[0];
        appealDetail = {
          id: latestAppeal.id,
          status: latestAppeal.status,
          reason: latestAppeal.reason,
          resolution: latestAppeal.resolution,
          resolvedAt: latestAppeal.resolvedAt,
          createdAt: latestAppeal.createdAt,
        };
      }
    } else {
      const now = new Date();
      if (assignment.dueAt && now > assignment.dueAt) {
        studentStatus = "OVERDUE";
      } else {
        studentStatus = "NOT_STARTED";
      }
    }

    return Object.assign(assignment, {
      studentStatus,
      submission: submissionDetail,
      appeal: appealDetail,
    });
  }

  async findAssignmentsByCourseId(courseId: string): Promise<Assignment[]> {
    const courseExists = await this.dataSource
      .getRepository(Course)
      .existsBy({ id: courseId });

    if (!courseExists) {
      throw new AssignmentCourseNotFoundError(courseId);
    }

    return this.dataSource.getRepository(Assignment).find({
      where: { courseId },
      order: {
        createdAt: "DESC",
      },
    });
  }

  async findStudentAssignmentsWithStatus(
    studentId: string,
    courseId: string,
  ): Promise<StudentAssignmentResult[]> {
    const studentExists = await this.dataSource
      .getRepository(Student)
      .existsBy({ userId: studentId });

    if (!studentExists) {
      throw new AssignmentStudentNotFoundError(studentId);
    }

    const courseExists = await this.dataSource
      .getRepository(Course)
      .existsBy({ id: courseId });

    if (!courseExists) {
      throw new AssignmentCourseNotFoundError(courseId);
    }

    const isEnrolled = await this.dataSource
      .getRepository(Enrollment)
      .existsBy({
        studentId,
        courseId,
        status: MembershipStatus.ACTIVE,
      });

    if (!isEnrolled) {
      throw new StudentNotEnrolledInCourseError(studentId, courseId);
    }

    const assignments = await this.dataSource.getRepository(Assignment).find({
      where: { courseId },
      order: {
        createdAt: "ASC",
      },
    });

    if (assignments.length === 0) {
      return [];
    }

    const assignmentIds = assignments.map((a) => a.id);
    const submissions = await this.dataSource.getRepository(Submission).find({
      where: {
        studentId,
        assignmentId: In(assignmentIds),
      },
      relations: {
        evaluations: true,
      },
      order: {
        attemptNumber: "DESC",
      },
    });

    // Group latest submission by assignmentId
    const latestSubmissionByAssignment = new Map<string, Submission>();
    for (const submission of submissions) {
      if (!latestSubmissionByAssignment.has(submission.assignmentId)) {
        latestSubmissionByAssignment.set(submission.assignmentId, submission);
      }
    }

    const now = new Date();

    return assignments.map((assignment) => {
      const submission = latestSubmissionByAssignment.get(assignment.id);
      let studentStatus: StudentAssignmentStatus = "NOT_STARTED";
      let submissionSummary: StudentAssignmentSubmissionSummary | null = null;

      if (submission) {
        let evaluationSummary: StudentAssignmentEvaluationSummary | null = null;
        const finalEval =
          submission.evaluations?.find(
            (e) => e.isFinal && e.status === EvaluationStatus.COMPLETED,
          ) ||
          submission.evaluations?.find(
            (e) => e.status === EvaluationStatus.COMPLETED,
          );

        if (finalEval) {
          evaluationSummary = {
            id: finalEval.id,
            score: finalEval.score,
            maxScore: finalEval.maxScore,
            feedback: finalEval.feedback,
            status: finalEval.status,
            isFinal: finalEval.isFinal,
          };
        }

        submissionSummary = {
          id: submission.id,
          attemptNumber: submission.attemptNumber,
          status: submission.status,
          submittedAt: submission.submittedAt,
          evaluation: evaluationSummary,
        };

        if (submission.status === SubmissionStatus.SUBMITTED) {
          studentStatus = evaluationSummary ? "GRADED" : "SUBMITTED";
        } else {
          studentStatus = "DRAFT";
        }
      } else {
        if (assignment.dueAt && new Date(assignment.dueAt) < now) {
          studentStatus = "OVERDUE";
        } else {
          studentStatus = "NOT_STARTED";
        }
      }

      return Object.assign(assignment, {
        studentStatus,
        submission: submissionSummary,
      });
    });
  }

  async findAllStudentAssignmentsWithStatus(
    studentId: string,
    options?: StudentAssignmentsQueryOptions,
  ): Promise<StudentAssignmentResult[]> {
    const studentExists = await this.dataSource
      .getRepository(Student)
      .existsBy({ userId: studentId });

    if (!studentExists) {
      throw new AssignmentStudentNotFoundError(studentId);
    }

    const enrollments = await this.dataSource.getRepository(Enrollment).find({
      where: {
        studentId,
        status: MembershipStatus.ACTIVE,
      },
    });

    if (enrollments.length === 0) {
      return [];
    }

    const courseIds = enrollments.map((e) => e.courseId);

    const assignments = await this.dataSource.getRepository(Assignment).find({
      where: { courseId: In(courseIds) },
      relations: { course: true },
      order: {
        dueAt: "ASC",
        createdAt: "DESC",
      },
    });

    if (assignments.length === 0) {
      return [];
    }

    const assignmentIds = assignments.map((a) => a.id);
    const submissions = await this.dataSource.getRepository(Submission).find({
      where: {
        studentId,
        assignmentId: In(assignmentIds),
      },
      relations: {
        evaluations: true,
      },
      order: {
        attemptNumber: "DESC",
      },
    });

    const latestSubmissionByAssignment = new Map<string, Submission>();
    for (const submission of submissions) {
      if (!latestSubmissionByAssignment.has(submission.assignmentId)) {
        latestSubmissionByAssignment.set(submission.assignmentId, submission);
      }
    }

    const now = new Date();

    let results: StudentAssignmentResult[] = assignments.map((assignment) => {
      const submission = latestSubmissionByAssignment.get(assignment.id);
      let studentStatus: StudentAssignmentStatus = "NOT_STARTED";
      let submissionSummary: StudentAssignmentSubmissionSummary | null = null;

      if (submission) {
        let evaluationSummary: StudentAssignmentEvaluationSummary | null = null;
        const finalEval =
          submission.evaluations?.find(
            (e) => e.isFinal && e.status === EvaluationStatus.COMPLETED,
          ) ||
          submission.evaluations?.find(
            (e) => e.status === EvaluationStatus.COMPLETED,
          );

        if (finalEval) {
          evaluationSummary = {
            id: finalEval.id,
            score: finalEval.score,
            maxScore: finalEval.maxScore,
            feedback: finalEval.feedback,
            status: finalEval.status,
            isFinal: finalEval.isFinal,
          };
        }

        submissionSummary = {
          id: submission.id,
          attemptNumber: submission.attemptNumber,
          status: submission.status,
          submittedAt: submission.submittedAt,
          evaluation: evaluationSummary,
        };

        if (submission.status === SubmissionStatus.SUBMITTED) {
          studentStatus = evaluationSummary ? "GRADED" : "SUBMITTED";
        } else {
          studentStatus = "DRAFT";
        }
      } else {
        if (assignment.dueAt && new Date(assignment.dueAt) < now) {
          studentStatus = "OVERDUE";
        } else {
          studentStatus = "NOT_STARTED";
        }
      }

      return Object.assign(assignment, {
        studentStatus,
        submission: submissionSummary,
      });
    });

    // Handle upcoming filter (unsubmitted or in-progress assignments with upcoming deadlines)
    if (options?.upcoming || options?.status?.toUpperCase() === "UPCOMING") {
      results = results.filter(
        (a) =>
          a.status === AssignmentStatus.PUBLISHED &&
          (a.studentStatus === "NOT_STARTED" ||
            a.studentStatus === "DRAFT" ||
            a.studentStatus === "OVERDUE"),
      );

      // Sort upcoming by closest due date first, assignments without due date at the end
      results.sort((a, b) => {
        if (!a.dueAt && !b.dueAt) return 0;
        if (!a.dueAt) return 1;
        if (!b.dueAt) return -1;
        return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      });
    } else if (options?.status) {
      const targetStatus = options.status.toUpperCase();
      if (targetStatus === "GRADED") {
        results = results.filter(
          (a) =>
            a.studentStatus === "GRADED" ||
            (a.submission?.evaluation &&
              a.submission.evaluation.status === EvaluationStatus.COMPLETED),
        );
      } else {
        results = results.filter(
          (a) => a.studentStatus.toUpperCase() === targetStatus,
        );
      }
    }

    // Handle explicit sorting
    if (options?.sort) {
      const [field, dir] = options.sort.split(":");
      const isAsc = dir?.toLowerCase() === "asc";

      if (field === "dueAt") {
        results.sort((a, b) => {
          if (!a.dueAt && !b.dueAt) return 0;
          if (!a.dueAt) return 1;
          if (!b.dueAt) return -1;
          const diff =
            new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
          return isAsc ? diff : -diff;
        });
      } else if (field === "gradedAt" || field === "submittedAt") {
        results.sort((a, b) => {
          const timeA = a.submission?.submittedAt
            ? new Date(a.submission.submittedAt).getTime()
            : 0;
          const timeB = b.submission?.submittedAt
            ? new Date(b.submission.submittedAt).getTime()
            : 0;
          const diff = timeA - timeB;
          return isAsc ? diff : -diff;
        });
      } else if (field === "createdAt") {
        results.sort((a, b) => {
          const diff =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          return isAsc ? diff : -diff;
        });
      }
    }

    // Apply limit if specified
    if (options?.limit && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  async findStudentRecentGrades(
    studentId: string,
    limit: number = 5,
  ): Promise<StudentAssignmentResult[]> {
    return this.findAllStudentAssignmentsWithStatus(studentId, {
      status: "GRADED",
      sort: "gradedAt:desc",
      limit,
    });
  }

  async deleteAssignment(assignmentId: string): Promise<boolean> {
    const result = await this.dataSource
      .getRepository(Assignment)
      .delete(assignmentId);
    return result.affected === 1;
  }

  private extractCourseCode(courseName: string): string {
    const match = courseName.match(/^([A-Za-z0-9]+)\s*:/);
    if (match) return match[1];
    const parts = courseName.trim().split(/\s+/);
    return parts[0] || "COURSE";
  }

  async findLecturerAssignmentOverview(
    assignmentId: string,
    options?: LecturerAssignmentOverviewOptions,
  ): Promise<LecturerAssignmentOverviewResponse> {
    const assignment = await this.dataSource.getRepository(Assignment).findOne({
      where: { id: assignmentId },
      relations: { course: true },
    });

    if (!assignment) {
      throw new AssignmentNotFoundError(assignmentId);
    }

    const courseCode = this.extractCourseCode(assignment.course.name);

    // Fetch active enrollments in the course with student profile and user details
    const enrollments = await this.dataSource.getRepository(Enrollment).find({
      where: {
        courseId: assignment.courseId,
        status: MembershipStatus.ACTIVE,
      },
      relations: {
        student: {
          user: true,
        },
      },
      order: {
        student: {
          user: {
            name: "ASC",
          },
        },
      },
    });

    // Fetch all submissions for this assignment with files, evaluations, and appeals
    const submissions = await this.dataSource.getRepository(Submission).find({
      where: { assignmentId },
      relations: {
        files: {
          file: true,
        },
        evaluations: true,
        appeals: true,
      },
      order: {
        attemptNumber: "DESC",
      },
    });

    // Fetch all appeals related to this assignment's submissions
    const appeals = await this.dataSource.getRepository(Appeal).find({
      where: {
        submission: {
          assignmentId,
        },
      },
      relations: {
        submission: true,
      },
      order: {
        createdAt: "DESC",
      },
    });

    const now = new Date();

    // Map student latest submissions
    const latestSubmissionsByStudent = new Map<string, Submission>();
    for (const sub of submissions) {
      if (!latestSubmissionsByStudent.has(sub.studentId)) {
        latestSubmissionsByStudent.set(sub.studentId, sub);
      }
    }

    // Build student roster items for every enrolled student
    const studentItems: LecturerAssignmentStudentItem[] = enrollments.map(
      (enrollment) => {
        const user = enrollment.student.user;
        const studentInfo: LecturerAssignmentStudentInfo = {
          userId: user.id,
          name: user.name,
          email: user.email,
          studentNumber: user.ltiSubject || user.id.substring(0, 8),
        };

        const sub = latestSubmissionsByStudent.get(enrollment.studentId);
        let submissionInfo: LecturerAssignmentSubmissionInfo | null = null;
        let evaluationInfo: LecturerAssignmentEvaluationInfo | null = null;
        let appealInfo: LecturerAssignmentAppealInfo | null = null;
        let status: LecturerAssignmentStudentStatus = "NOT_STARTED";

        // Find any appeal associated with this student for this assignment
        const studentAppeal = appeals.find(
          (a) => a.studentId === enrollment.studentId,
        );
        if (studentAppeal) {
          appealInfo = {
            id: studentAppeal.id,
            status: studentAppeal.status,
            reason: studentAppeal.reason,
            createdAt: studentAppeal.createdAt,
          };
        }

        if (sub) {
          submissionInfo = {
            id: sub.id,
            attemptNumber: sub.attemptNumber,
            submittedAt: sub.submittedAt,
            filesCount: sub.files?.length || 0,
          };

          // Find final evaluation or completed evaluation
          const finalEval =
            sub.evaluations?.find(
              (e) => e.isFinal && e.status === EvaluationStatus.COMPLETED,
            ) ||
            sub.evaluations?.find(
              (e) =>
                e.status === EvaluationStatus.COMPLETED && e.score !== null,
            );

          const inProgressEval = sub.evaluations?.find(
            (e) =>
              e.status === EvaluationStatus.PENDING ||
              e.status === EvaluationStatus.PROCESSING ||
              (e.status === EvaluationStatus.COMPLETED && !e.isFinal),
          );

          if (finalEval && finalEval.score !== null) {
            const pct =
              finalEval.maxScore > 0
                ? Math.round((finalEval.score / finalEval.maxScore) * 1000) / 10
                : 0;
            evaluationInfo = {
              id: finalEval.id,
              score: finalEval.score,
              maxScore: finalEval.maxScore,
              percentage: pct,
              isFinal: finalEval.isFinal,
              feedback: finalEval.feedback,
              evaluatedAt: finalEval.completedAt,
            };
          }

          // Determine status
          if (
            studentAppeal &&
            (studentAppeal.status === AppealStatus.SUBMITTED ||
              studentAppeal.status === AppealStatus.UNDER_REVIEW)
          ) {
            status = "APPEAL";
          } else if (evaluationInfo) {
            status = "GRADED";
          } else if (
            inProgressEval ||
            (sub.evaluations && sub.evaluations.length > 0)
          ) {
            status = "EVALUATING";
          } else if (sub.status === SubmissionStatus.SUBMITTED) {
            status = "SUBMITTED";
          } else if (assignment.dueAt && now > assignment.dueAt) {
            status = "OVERDUE";
          } else {
            status = "NOT_STARTED";
          }
        } else {
          if (assignment.dueAt && now > assignment.dueAt) {
            status = "OVERDUE";
          } else {
            status = "NOT_STARTED";
          }
        }

        return {
          student: studentInfo,
          status,
          submission: submissionInfo,
          evaluation: evaluationInfo,
          appeal: appealInfo,
        };
      },
    );

    // Calculate class-wide aggregate stats
    const totalStudents = enrollments.length;
    const submittedCount = studentItems.filter((item) =>
      ["GRADED", "EVALUATING", "SUBMITTED", "APPEAL"].includes(item.status),
    ).length;
    const missingCount = Math.max(0, totalStudents - submittedCount);
    const gradedCount = studentItems.filter(
      (item) => item.status === "GRADED",
    ).length;
    const evaluatingCount = studentItems.filter(
      (item) => item.status === "EVALUATING",
    ).length;
    const appealsCount = appeals.length;

    const gradedPercentages = studentItems
      .filter((item) => item.evaluation && item.evaluation.score !== null)
      .map((item) => item.evaluation!.percentage);

    const averageScore =
      gradedPercentages.length > 0
        ? Math.round(
            (gradedPercentages.reduce((sum, val) => sum + val, 0) /
              gradedPercentages.length) *
              10,
          ) / 10
        : 0;

    const submissionRate =
      totalStudents > 0
        ? Math.round((submittedCount / totalStudents) * 100)
        : 0;

    const remainingHours = assignment.dueAt
      ? Math.round(
          (new Date(assignment.dueAt).getTime() - now.getTime()) /
            (1000 * 60 * 60),
        )
      : null;

    const stats: LecturerAssignmentStats = {
      totalStudents,
      submitted: submittedCount,
      missing: missingCount,
      graded: gradedCount,
      evaluating: evaluatingCount,
      appealsCount,
      averageScore,
      submissionRate,
      remainingHours,
    };

    // Apply optional search and status filtering on the roster
    let filteredStudents = studentItems;

    if (options?.search && options.search.trim() !== "") {
      const q = options.search.trim().toLowerCase();
      filteredStudents = filteredStudents.filter(
        (item) =>
          item.student.name.toLowerCase().includes(q) ||
          item.student.email.toLowerCase().includes(q) ||
          (item.student.studentNumber &&
            item.student.studentNumber.toLowerCase().includes(q)),
      );
    }

    if (options?.status && options.status.trim() !== "") {
      const targetStatus = options.status.trim().toUpperCase();
      filteredStudents = filteredStudents.filter(
        (item) => item.status === targetStatus,
      );
    }

    return {
      id: assignment.id,
      courseId: assignment.courseId,
      name: assignment.name,
      description: assignment.description,
      type: assignment.type,
      evaluationInstructions: assignment.evaluationInstructions,
      maxScore: assignment.maxScore,
      status: assignment.status,
      startAt: assignment.startAt,
      dueAt: assignment.dueAt,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
      course: {
        id: assignment.course.id,
        name: assignment.course.name,
        code: courseCode,
        semester: assignment.course.semester,
        academicYear: assignment.course.academicYear,
      },
      stats,
      students: filteredStudents,
    };
  }
}
