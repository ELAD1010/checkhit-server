export enum UserRole {
  STUDENT = "STUDENT",
  LECTURER = "LECTURER",
}

export enum MembershipStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
}

export enum LecturerPermission {
  OWNER = "OWNER",
  EDITOR = "EDITOR",
}

export enum AssignmentStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  CLOSED = "CLOSED",
  ARCHIVED = "ARCHIVED",
}

export enum SubmissionStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
}

export enum EvaluationStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum QuestionImportStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  SUPERSEDED = "SUPERSEDED",
}

export enum QuestionSource {
  MANUAL = "MANUAL",
  DOCUMENT_IMPORT = "DOCUMENT_IMPORT",
}

export enum AppealStatus {
  SUBMITTED = "SUBMITTED",
  UNDER_REVIEW = "UNDER_REVIEW",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
}

export enum NotificationCategory {
  ASSIGNMENT = "ASSIGNMENT",
  GRADE = "GRADE",
  APPEAL = "APPEAL",
  WARNING = "WARNING",
  SYSTEM = "SYSTEM",
  INFO = "INFO",
}

export enum MessageTargetType {
  DIRECT = "DIRECT",
  BROADCAST = "BROADCAST",
  SYSTEM = "SYSTEM",
}

