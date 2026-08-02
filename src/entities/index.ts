import { Appeal } from "./appeal.js";
import { AppealFile } from "./appeal-file.js";
import { Assignment } from "./assignment.js";
import { Course } from "./course.js";
import { CourseLecturer } from "./course-lecturer.js";
import { Enrollment } from "./enrollment.js";
import { Evaluation } from "./evaluation.js";
import { FileAsset } from "./file-asset.js";
import { Lecturer } from "./lecturer.js";
import { LtiCourseContext } from "./lti-course-context.js";
import { LtiPlatform } from "./lti-platform.js";
import { LtiResourceLink } from "./lti-resource-link.js";
import { LtiUserIdentity } from "./lti-user-identity.js";
import { Resource } from "./resource.js";
import { ResourceFile } from "./resource-file.js";
import { Student } from "./student.js";
import { Submission } from "./submission.js";
import { SubmissionFile } from "./submission-file.js";
import { User } from "./user.js";

export { Appeal } from "./appeal.js";
export { AppealFile } from "./appeal-file.js";
export { Assignment } from "./assignment.js";
export { Course } from "./course.js";
export { CourseLecturer } from "./course-lecturer.js";
export { Enrollment } from "./enrollment.js";
export * from "./enums.js";
export { Evaluation } from "./evaluation.js";
export { FileAsset } from "./file-asset.js";
export { Lecturer } from "./lecturer.js";
export { LtiCourseContext } from "./lti-course-context.js";
export { LtiPlatform } from "./lti-platform.js";
export { LtiResourceLink } from "./lti-resource-link.js";
export { LtiUserIdentity } from "./lti-user-identity.js";
export { Resource } from "./resource.js";
export { ResourceFile } from "./resource-file.js";
export { Student } from "./student.js";
export { Submission } from "./submission.js";
export { SubmissionFile } from "./submission-file.js";
export { User } from "./user.js";

export const DOMAIN_ENTITIES = [
  User,
  Student,
  Lecturer,
  Course,
  CourseLecturer,
  Enrollment,
  Resource,
  Assignment,
  Submission,
  Evaluation,
  Appeal,
  FileAsset,
  ResourceFile,
  SubmissionFile,
  AppealFile,
  LtiPlatform,
  LtiUserIdentity,
  LtiCourseContext,
  LtiResourceLink,
];
