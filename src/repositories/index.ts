export {
  AppealRepository,
  AppealStudentNotFoundError,
} from "./appeal.repository.js";
export {
  AssignmentCourseNotFoundError,
  AssignmentRepository,
  type CreateAssignmentInput,
} from "./assignment.repository.js";
export {
  type CreateCourseInput,
  CourseRepository,
  LecturersNotFoundError,
} from "./course.repository.js";
export {
  type CreateUserInput,
  UserRepository,
} from "./user.repository.js";
export {
  type CreateNotificationInput,
  type FindNotificationsOptions,
  NotificationNotFoundError,
  NotificationRepository,
  NotificationUserNotFoundError,
} from "./notification.repository.js";
export {
  type CreateMessageInput,
  type CreateReplyInput,
  type FindUserMessagesOptions,
  MessageCourseNotFoundError,
  MessageInvalidRecipientError,
  MessageNotFoundError,
  MessageRepository,
  MessageUserNotFoundError,
  type PaginatedMessagesResult,
} from "./message.repository.js";
export {
  DashboardRepository,
  LecturerNotFoundError,
  type LecturerDashboardResponse,
  type LecturerDashboardKpis,
  type RequiresAttentionItem,
  type GradeDistributionData,
  type GradeDistributionCourseData,
  type GradeDistributionRange,
  type AssignmentCompletionItem,
  type DashboardCourseItem,
} from "./dashboard.repository.js";
