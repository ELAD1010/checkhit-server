import { DataSource, In } from "typeorm";
import { AppDataSource } from "../database/data-source.js";
import { Assignment } from "../entities/assignment.js";
import { Appeal } from "../entities/appeal.js";
import { Evaluation } from "../entities/evaluation.js";
import {
  AppealStatus,
  AssignmentStatus,
  EvaluationStatus,
  MembershipStatus,
  MessageTargetType,
  NotificationCategory,
  SubmissionStatus,
  UserRole,
} from "../entities/enums.js";
import { Message } from "../entities/message.js";
import { Submission } from "../entities/submission.js";
import { User } from "../entities/user.js";
import type { CreateNotificationInput } from "../repositories/notification.repository.js";
import { NotificationRepository } from "../repositories/notification.repository.js";
import { notificationLiveService } from "./notification-live.service.js";

type NotificationPayload = Omit<CreateNotificationInput, "recipientId">;

export class NotificationService {
  private readonly repository: NotificationRepository;

  constructor(private readonly dataSource: DataSource = AppDataSource) {
    this.repository = new NotificationRepository(dataSource);
  }

  async send(recipientIds: string[], payload: NotificationPayload): Promise<void> {
    const uniqueIds = [...new Set(recipientIds)];
    await Promise.all(
      uniqueIds.map(async (recipientId) => {
        const result = await this.repository.createNotificationIfAbsent({
          recipientId,
          ...payload,
        });
        if (result.created) notificationLiveService.publish(result.notification);
      }),
    );
  }

  async safely(label: string, operation: () => Promise<void>): Promise<void> {
    try {
      await operation();
    } catch (error) {
      console.error(`Failed to emit ${label} notification:`, error);
    }
  }

  async notifyAssignmentPublished(assignmentId: string): Promise<void> {
    const assignment = await this.assignmentContext(assignmentId);
    if (!assignment || assignment.status !== AssignmentStatus.PUBLISHED) return;
    await this.send(
      assignment.course.enrollments
        .filter((item) => item.status === MembershipStatus.ACTIVE)
        .map((item) => item.studentId),
      {
        title: "New assignment published",
        body: `${assignment.name} is now available in ${assignment.course.name}.`,
        category: NotificationCategory.ASSIGNMENT,
        link: `/student/assignments/${assignment.id}`,
        eventKey: `ASSIGNMENT_PUBLISHED:${assignment.id}`,
        metadata: { assignmentId: assignment.id, courseId: assignment.courseId },
      },
    );
  }

  async notifySubmissionSubmitted(submissionId: string): Promise<void> {
    const submission = await this.submissionContext(submissionId);
    if (!submission || submission.status !== SubmissionStatus.SUBMITTED) return;
    const metadata = {
      submissionId: submission.id,
      assignmentId: submission.assignmentId,
      courseId: submission.assignment.courseId,
      studentId: submission.studentId,
    };
    await this.send([submission.studentId], {
      title: "Submission received",
      body: `Your submission for ${submission.assignment.name} was received.`,
      category: NotificationCategory.INFO,
      link: `/student/assignments/${submission.assignmentId}`,
      eventKey: `SUBMISSION_RECEIVED:${submission.id}`,
      metadata,
    });
    await this.send(
      submission.assignment.course.lecturers.map((item) => item.lecturerId),
      {
        title: "New submission",
        body: `${submission.student.user.name} submitted ${submission.assignment.name}.`,
        category: NotificationCategory.ASSIGNMENT,
        link: `/lecturer/assignments/${submission.assignmentId}`,
        eventKey: `SUBMISSION_RECEIVED_LECTURER:${submission.id}`,
        metadata,
      },
    );
  }

  async notifyEvaluationCompleted(evaluationId: string): Promise<void> {
    const evaluation = await this.evaluationContext(evaluationId);
    if (!evaluation || evaluation.status !== EvaluationStatus.COMPLETED || !evaluation.isFinal) return;
    const submission = evaluation.submission;
    await this.send([submission.studentId], {
      title: "Grade available",
      body: `Your grade for ${submission.assignment.name} is ready: ${evaluation.score}/${evaluation.maxScore}.`,
      category: NotificationCategory.GRADE,
      link: `/student/assignments/${submission.assignmentId}`,
      eventKey: `GRADE_READY:${evaluation.id}`,
      metadata: {
        evaluationId: evaluation.id,
        submissionId: submission.id,
        assignmentId: submission.assignmentId,
        score: evaluation.score,
        maxScore: evaluation.maxScore,
      },
    });
  }

  async notifyEvaluationFailed(evaluationId: string): Promise<void> {
    const evaluation = await this.evaluationContext(evaluationId);
    if (!evaluation || evaluation.status !== EvaluationStatus.FAILED) return;
    const submission = evaluation.submission;
    const metadata = {
      evaluationId: evaluation.id,
      submissionId: submission.id,
      assignmentId: submission.assignmentId,
      studentId: submission.studentId,
    };
    await this.send([submission.studentId], {
      title: "Grading delayed",
      body: `We could not finish grading ${submission.assignment.name}. Your lecturer has been notified.`,
      category: NotificationCategory.WARNING,
      link: `/student/assignments/${submission.assignmentId}`,
      eventKey: `GRADING_FAILED_STUDENT:${evaluation.id}`,
      metadata,
    });
    await this.send(
      submission.assignment.course.lecturers.map((item) => item.lecturerId),
      {
        title: "Automated grading failed",
        body: `Grading failed for ${submission.student.user.name}'s submission to ${submission.assignment.name}.`,
        category: NotificationCategory.WARNING,
        link: `/lecturer/assignments/${submission.assignmentId}`,
        eventKey: `GRADING_FAILED_LECTURER:${evaluation.id}`,
        metadata: { ...metadata, errorMessage: evaluation.errorMessage },
      },
    );
  }

  async notifyAppeal(appealId: string): Promise<void> {
    const appeal = await this.appealContext(appealId);
    if (!appeal) return;
    const assignment = appeal.submission.assignment;
    const common = {
      appealId: appeal.id,
      assignmentId: assignment.id,
      courseId: assignment.courseId,
      studentId: appeal.studentId,
      status: appeal.status,
    };
    if (appeal.status === AppealStatus.SUBMITTED) {
      await this.send([appeal.studentId], {
        title: "Appeal received",
        body: `Your appeal for ${assignment.name} was received.`,
        category: NotificationCategory.APPEAL,
        link: `/student/assignments/${assignment.id}`,
        eventKey: `APPEAL_RECEIVED:${appeal.id}`,
        metadata: common,
      });
      await this.send(assignment.course.lecturers.map((item) => item.lecturerId), {
        title: "New grade appeal",
        body: `${appeal.student.user.name} appealed the grade for ${assignment.name}.`,
        category: NotificationCategory.APPEAL,
        link: `/lecturer/appeals/${appeal.id}`,
        eventKey: `APPEAL_SUBMITTED:${appeal.id}`,
        metadata: common,
      });
    } else if (appeal.status === AppealStatus.UNDER_REVIEW) {
      await this.send([appeal.studentId], {
        title: "Appeal under review",
        body: `Your appeal for ${assignment.name} is being reviewed.`,
        category: NotificationCategory.APPEAL,
        link: `/student/assignments/${assignment.id}`,
        eventKey: `APPEAL_UNDER_REVIEW:${appeal.id}`,
        metadata: common,
      });
      if (appeal.reviewerId) {
        await this.send([appeal.reviewerId], {
          title: "Appeal assigned to you",
          body: `Review ${appeal.student.user.name}'s appeal for ${assignment.name}.`,
          category: NotificationCategory.APPEAL,
          link: `/lecturer/appeals/${appeal.id}`,
          eventKey: `APPEAL_ASSIGNED:${appeal.id}:${appeal.reviewerId}`,
          metadata: common,
        });
      }
    } else {
      const accepted = appeal.status === AppealStatus.ACCEPTED;
      await this.send([appeal.studentId], {
        title: `Appeal ${appeal.status.toLowerCase().replace("_", " ")}`,
        body: accepted
          ? `Your appeal for ${assignment.name} was accepted.`
          : `Your appeal for ${assignment.name} was ${appeal.status.toLowerCase()}.`,
        category: NotificationCategory.APPEAL,
        link: `/student/assignments/${assignment.id}`,
        eventKey: `APPEAL_RESOLVED:${appeal.id}:${appeal.status}`,
        metadata: { ...common, resolution: appeal.resolution },
      });
    }
  }

  async notifyMessage(messageId: string): Promise<void> {
    const message = await this.dataSource.getRepository(Message).findOne({
      where: { id: messageId },
      relations: { sender: true, recipients: true, course: true },
    });
    if (!message) return;
    let recipients = message.recipients
      .map((item) => item.recipientId)
      .filter((id) => id !== message.senderId);
    if (recipients.length === 0 && message.parentMessageId) {
      const root = await this.dataSource.getRepository(Message).findOne({
        where: { id: message.parentMessageId },
        relations: { recipients: true },
      });
      recipients = (
        root?.targetType === MessageTargetType.BROADCAST &&
        message.senderId !== root.senderId
          ? [root.senderId]
          : [
              ...(root?.recipients ?? []).map((item) => item.recipientId),
              ...(root ? [root.senderId] : []),
            ]
      ).filter((id) => id !== message.senderId);
    }
    if (recipients.length === 0) return;
    const shouldNotify =
      message.targetType === MessageTargetType.DIRECT ||
      message.targetType === MessageTargetType.SYSTEM ||
      message.isPriority ||
      Boolean(message.parentMessageId);
    if (!shouldNotify) return;
    const threadId = message.parentMessageId ?? message.id;
    const users = await this.dataSource.getRepository(User).find({
      where: { id: In(recipients) },
      select: { id: true, role: true },
    });
    const payload = {
      title: message.isPriority
        ? "Priority message"
        : message.parentMessageId
          ? "New message reply"
          : message.targetType === MessageTargetType.SYSTEM
            ? "System announcement"
            : "New direct message",
      body: `${message.sender.name}: ${message.subject}`,
      category: NotificationCategory.INFO,
      eventKey: `MESSAGE:${message.id}`,
      metadata: { messageId: message.id, threadId, courseId: message.courseId },
    };
    for (const portal of [UserRole.LECTURER, UserRole.STUDENT]) {
      const portalRecipients = users
        .filter((user) => user.role === portal)
        .map((user) => user.id);
      if (portalRecipients.length === 0) continue;
      await this.send(portalRecipients, {
        ...payload,
        link: `/${portal === UserRole.LECTURER ? "lecturer" : "student"}/messages?message=${threadId}`,
      });
    }
  }

  private assignmentContext(id: string) {
    return this.dataSource.getRepository(Assignment).findOne({
      where: { id },
      relations: { course: { enrollments: true, lecturers: true }, questions: true },
    });
  }

  private submissionContext(id: string) {
    return this.dataSource.getRepository(Submission).findOne({
      where: { id },
      relations: {
        student: { user: true },
        assignment: { course: { lecturers: true } },
      },
    });
  }

  private evaluationContext(id: string) {
    return this.dataSource.getRepository(Evaluation).findOne({
      where: { id },
      relations: {
        submission: {
          student: { user: true },
          assignment: { course: { lecturers: true } },
        },
      },
    });
  }

  private appealContext(id: string) {
    return this.dataSource.getRepository(Appeal).findOne({
      where: { id },
      relations: {
        student: { user: true },
        evaluation: true,
        submission: { assignment: { course: { lecturers: true } } },
      },
    });
  }
}

export const notificationService = new NotificationService();
