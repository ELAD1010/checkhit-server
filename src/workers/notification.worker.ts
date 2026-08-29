import { In } from "typeorm";
import { AppDataSource } from "../database/data-source.js";
import { Appeal } from "../entities/appeal.js";
import { Assignment } from "../entities/assignment.js";
import { Enrollment } from "../entities/enrollment.js";
import { CourseLecturer } from "../entities/course-lecturer.js";
import { Evaluation } from "../entities/evaluation.js";
import {
  AppealStatus,
  AssignmentStatus,
  EvaluationStatus,
  MembershipStatus,
  NotificationCategory,
  SubmissionStatus,
} from "../entities/enums.js";
import { Message } from "../entities/message.js";
import { Submission } from "../entities/submission.js";
import { notificationService } from "../services/notification.service.js";

const DAY = 24 * 60 * 60 * 1000;

export class NotificationWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  start(): void {
    if (this.timer || process.env.NOTIFICATION_WORKER_ENABLED === "false") return;
    const interval = Math.max(
      15_000,
      Number(process.env.NOTIFICATION_POLL_INTERVAL_MS) || 60_000,
    );
    this.timer = setInterval(() => void this.tick(), interval);
    this.timer.unref?.();
    void this.tick();
    console.log("Notification worker started");
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async runOnce(): Promise<void> {
    await this.reconcileAssignments();
    await this.reconcileSubmissionsAndEvaluations();
    await this.reconcileAppeals();
    await this.reconcileMessages();
    await this.reconcileMemberships();
    await this.reconcileLecturerAssignments();
  }

  private async tick(): Promise<void> {
    if (this.running || !AppDataSource.isInitialized) return;
    this.running = true;
    try {
      await this.runOnce();
    } catch (error) {
      console.error("Notification worker failed:", error);
    } finally {
      this.running = false;
    }
  }

  private async reconcileAssignments(): Promise<void> {
    const assignments = await AppDataSource.getRepository(Assignment).find({
      where: {
        status: In([AssignmentStatus.PUBLISHED, AssignmentStatus.CLOSED]),
      },
      relations: {
        course: { enrollments: true, lecturers: true },
        questions: true,
        submissions: { evaluations: true },
      },
    });
    const now = Date.now();
    for (const assignment of assignments) {
      const students = assignment.course.enrollments
        .filter((item) => item.status === MembershipStatus.ACTIVE)
        .map((item) => item.studentId);
      const lecturers = assignment.course.lecturers.map((item) => item.lecturerId);
      if (assignment.status === AssignmentStatus.CLOSED) {
        await notificationService.send(students, {
          title: "Assignment closed",
          body: `${assignment.name} is now closed.`,
          category: NotificationCategory.WARNING,
          link: `/student/assignments/${assignment.id}`,
          eventKey: `ASSIGNMENT_CLOSED:${assignment.id}`,
          metadata: { assignmentId: assignment.id, courseId: assignment.courseId },
        });
        continue;
      }
      await notificationService.notifyAssignmentPublished(assignment.id);
      const submittedIds = new Set(
        assignment.submissions
          .filter((item) => item.status === SubmissionStatus.SUBMITTED)
          .map((item) => item.studentId),
      );
      const incomplete = students.filter((id) => !submittedIds.has(id));
      const dateKey = assignment.dueAt?.toISOString() ?? "none";

      if (assignment.dueAt && assignment.dueAt.getTime() > now) {
        await notificationService.send(students, {
          title: "Assignment deadline",
          body: `${assignment.name} is due on ${assignment.dueAt.toLocaleString()}.`,
          category: NotificationCategory.ASSIGNMENT,
          link: `/student/assignments/${assignment.id}`,
          eventKey: `ASSIGNMENT_DEADLINE:${assignment.id}:${dateKey}`,
          metadata: { assignmentId: assignment.id, courseId: assignment.courseId, dueAt: assignment.dueAt },
        });
      }

      if (assignment.startAt && assignment.startAt.getTime() <= now) {
        await notificationService.send(students, {
          title: "Assignment available",
          body: `${assignment.name} is now open.`,
          category: NotificationCategory.ASSIGNMENT,
          link: `/student/assignments/${assignment.id}`,
          eventKey: `ASSIGNMENT_OPEN:${assignment.id}:${assignment.startAt.toISOString()}`,
          metadata: { assignmentId: assignment.id, courseId: assignment.courseId },
        });
      }

      if (assignment.questions.filter((question) => question.isActive).length === 0) {
        await notificationService.send(lecturers, {
          title: "Assignment needs grading questions",
          body: `${assignment.name} is published but has no active grading questions.`,
          category: NotificationCategory.WARNING,
          link: `/lecturer/assignments/${assignment.id}`,
          eventKey: `ASSIGNMENT_INVALID:${assignment.id}:NO_QUESTIONS`,
          metadata: { assignmentId: assignment.id, courseId: assignment.courseId },
        });
      }

      const submitted = assignment.submissions.filter(
        (item) => item.status === SubmissionStatus.SUBMITTED,
      );
      const allGraded =
        submitted.length > 0 &&
        submitted.every((item) =>
          item.evaluations.some(
            (evaluation) =>
              evaluation.status === EvaluationStatus.COMPLETED &&
              evaluation.isFinal,
          ),
        );
      if (allGraded) {
        await notificationService.send(lecturers, {
          title: "All submissions graded",
          body: `All ${submitted.length} submitted attempts for ${assignment.name} are graded.`,
          category: NotificationCategory.GRADE,
          link: `/lecturer/assignments/${assignment.id}`,
          eventKey: `ALL_GRADED:${assignment.id}:${submitted.length}`,
          metadata: { assignmentId: assignment.id, submittedCount: submitted.length },
        });
      }

      if (!assignment.dueAt) continue;
      const remaining = assignment.dueAt.getTime() - now;
      if (remaining > DAY && remaining <= 7 * DAY) {
        await this.deadlineReminder(assignment, incomplete, "7 days", `DEADLINE_7D:${assignment.id}:${dateKey}`);
      }
      if (remaining > 0 && remaining <= DAY) {
        await this.deadlineReminder(assignment, incomplete, "24 hours", `DEADLINE_24H:${assignment.id}:${dateKey}`);
      }
      if (remaining <= 0) {
        await notificationService.send(incomplete, {
          title: "Assignment overdue",
          body: `The deadline for ${assignment.name} has passed.`,
          category: NotificationCategory.WARNING,
          link: `/student/assignments/${assignment.id}`,
          eventKey: `ASSIGNMENT_OVERDUE:${assignment.id}:${dateKey}`,
          metadata: { assignmentId: assignment.id, courseId: assignment.courseId, dueAt: assignment.dueAt },
        });
        await notificationService.send(lecturers, {
          title: "Assignment deadline reached",
          body: `${assignment.name}: ${submittedIds.size} submitted, ${incomplete.length} missing.`,
          category: NotificationCategory.INFO,
          link: `/lecturer/assignments/${assignment.id}`,
          eventKey: `DEADLINE_REACHED:${assignment.id}:${dateKey}`,
          metadata: { assignmentId: assignment.id, submittedCount: submittedIds.size, missingCount: incomplete.length },
        });
      }

    }
  }

  private deadlineReminder(
    assignment: Assignment,
    recipients: string[],
    label: string,
    eventKey: string,
  ): Promise<void> {
    return notificationService.send(recipients, {
      title: "Assignment deadline approaching",
      body: `${assignment.name} is due within ${label}.`,
      category: NotificationCategory.WARNING,
      link: `/student/assignments/${assignment.id}`,
      eventKey,
      metadata: { assignmentId: assignment.id, courseId: assignment.courseId, dueAt: assignment.dueAt },
    });
  }

  private async reconcileSubmissionsAndEvaluations(): Promise<void> {
    const submissions = await AppDataSource.getRepository(Submission).find({
      where: { status: SubmissionStatus.SUBMITTED },
      select: { id: true },
    });
    for (const submission of submissions) {
      await notificationService.notifySubmissionSubmitted(submission.id);
    }
    const evaluations = await AppDataSource.getRepository(Evaluation).find({
      where: [
        { status: EvaluationStatus.COMPLETED, isFinal: true },
        { status: EvaluationStatus.FAILED },
      ],
      select: { id: true, status: true },
    });
    for (const evaluation of evaluations) {
      if (evaluation.status === EvaluationStatus.COMPLETED) {
        await notificationService.notifyEvaluationCompleted(evaluation.id);
      } else {
        await notificationService.notifyEvaluationFailed(evaluation.id);
      }
    }
  }

  private async reconcileAppeals(): Promise<void> {
    const appeals = await AppDataSource.getRepository(Appeal).find();
    const staleBefore = Date.now() - 3 * DAY;
    for (const appeal of appeals) {
      await notificationService.notifyAppeal(appeal.id);
      if (
        (appeal.status === AppealStatus.SUBMITTED || appeal.status === AppealStatus.UNDER_REVIEW) &&
        appeal.createdAt.getTime() <= staleBefore
      ) {
        const full = await AppDataSource.getRepository(Appeal).findOne({
          where: { id: appeal.id },
          relations: { submission: { assignment: { course: { lecturers: true } } } },
        });
        if (!full) continue;
        const recipients = full.reviewerId
          ? [full.reviewerId]
          : full.submission.assignment.course.lecturers.map((item) => item.lecturerId);
        await notificationService.send(recipients, {
          title: "Appeal awaiting action",
          body: `An appeal for ${full.submission.assignment.name} has waited more than 3 days.`,
          category: NotificationCategory.WARNING,
          link: `/lecturer/appeals/${full.id}`,
          eventKey: `APPEAL_STALE:${full.id}:3D`,
          metadata: { appealId: full.id, assignmentId: full.submission.assignmentId },
        });
      }
    }
  }

  private async reconcileMessages(): Promise<void> {
    const messages = await AppDataSource.getRepository(Message).find({ select: { id: true } });
    for (const message of messages) await notificationService.notifyMessage(message.id);
  }

  private async reconcileMemberships(): Promise<void> {
    const enrollments = await AppDataSource.getRepository(Enrollment).find({ relations: { course: true } });
    for (const enrollment of enrollments) {
      const active = enrollment.status === MembershipStatus.ACTIVE;
      await notificationService.send([enrollment.studentId], {
        title: active ? "Course access available" : "Course access changed",
        body: active
          ? `You are enrolled in ${enrollment.course.name}.`
          : `Your access to ${enrollment.course.name} is no longer active.`,
        category: NotificationCategory.SYSTEM,
        link: active ? `/student/courses/${enrollment.courseId}` : null,
        eventKey: `ENROLLMENT:${enrollment.studentId}:${enrollment.courseId}:${enrollment.status}`,
        metadata: { courseId: enrollment.courseId, status: enrollment.status },
      });
    }
  }

  private async reconcileLecturerAssignments(): Promise<void> {
    const assignments = await AppDataSource.getRepository(CourseLecturer).find({
      relations: { course: true },
    });
    for (const assignment of assignments) {
      await notificationService.send([assignment.lecturerId], {
        title: "Course lecturer access",
        body: `You are assigned to ${assignment.course.name} as ${assignment.permissionLevel.toLowerCase()}.`,
        category: NotificationCategory.SYSTEM,
        link: `/lecturer/courses/${assignment.courseId}`,
        eventKey: `LECTURER_ASSIGNED:${assignment.courseId}:${assignment.lecturerId}:${assignment.permissionLevel}`,
        metadata: { courseId: assignment.courseId, permissionLevel: assignment.permissionLevel },
      });
    }
  }
}

export const notificationWorker = new NotificationWorker();
