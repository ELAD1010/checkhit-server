import { DataSource, In } from "typeorm";
import { AppDataSource } from "../database/data-source.js";
import { Assignment } from "../entities/assignment.js";
import { Course } from "../entities/course.js";
import { Student } from "../entities/student.js";
import { Enrollment } from "../entities/enrollment.js";
import { Submission } from "../entities/submission.js";
import {
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
  ltiResourceLinkId?: string | null;
  ltiLineItemUrl?: string | null;
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
};

export type StudentAssignmentSubmissionSummary = {
  id: string;
  attemptNumber: number;
  status: SubmissionStatus;
  submittedAt: Date | null;
  evaluation: StudentAssignmentEvaluationSummary | null;
};

export type StudentAssignmentResult = Assignment & {
  studentStatus: StudentAssignmentStatus;
  submission: StudentAssignmentSubmissionSummary | null;
};

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
  constructor(readonly studentId: string, readonly courseId: string) {
    super(`Student ${studentId} is not enrolled in course ${courseId}`);
    this.name = "StudentNotEnrolledInCourseError";
  }
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
        maxScore: input.maxScore,
        startAt: input.startAt ?? null,
        dueAt: input.dueAt ?? null,
        status: input.status ?? AssignmentStatus.DRAFT,
        ltiResourceLinkId: input.ltiResourceLinkId ?? null,
        ltiLineItemUrl: input.ltiLineItemUrl ?? null,
      }),
    );
  }

  async findAssignmentById(assignmentId: string): Promise<Assignment | null> {
    return this.dataSource.getRepository(Assignment).findOne({
      where: { id: assignmentId },
      relations: { course: true },
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
  ): Promise<StudentAssignmentResult[]> {
    const studentExists = await this.dataSource
      .getRepository(Student)
      .existsBy({ userId: studentId });

    if (!studentExists) {
      throw new AssignmentStudentNotFoundError(studentId);
    }

    const enrollments = await this.dataSource
      .getRepository(Enrollment)
      .find({
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

  async deleteAssignment(assignmentId: string): Promise<boolean> {
    const result = await this.dataSource
      .getRepository(Assignment)
      .delete(assignmentId);
    return result.affected === 1;
  }
}
