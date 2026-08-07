import callMoodleAPI from "../api/index.js";
import { IdToken } from "ltijs";
import { Request, Response } from "express";
import { LtiToken } from "../common/types/lti.js";
import {
  LtiLaunchDataError,
  LtiLaunchSyncService,
  LtiRoleConflictError,
  MoodleCourseMetadata,
} from "../services/lti-launch-sync.service.js";

type MoodleCourse = {
  fullname?: string;
  shortname?: string;
  startdate?: number;
};

const ltiLaunchSyncService = new LtiLaunchSyncService();

const loadMoodleCourseMetadata = async (
  externalCourseId: string,
): Promise<MoodleCourseMetadata> => {
  try {
    const courseResponse = await callMoodleAPI("core_course_get_courses", {
      "options[ids][0]": externalCourseId,
    });
    const moodleCourse =
      Array.isArray(courseResponse) && courseResponse.length > 0
        ? (courseResponse[0] as MoodleCourse)
        : undefined;

    return {
      name: moodleCourse?.fullname,
      semester: moodleCourse?.shortname,
      academicYear: moodleCourse?.startdate
        ? new Date(moodleCourse.startdate * 1000).getUTCFullYear()
        : undefined,
    };
  } catch (error) {
    console.warn(
      "Could not load Moodle course metadata; using LTI context claims:",
      error,
    );
    return {};
  }
};

export const login = async (
  token: IdToken,
  _req: Request,
  res: Response,
): Promise<unknown> => {
  try {
    const launchToken = token as LtiToken;
    const externalCourseId = launchToken.platformContext.context.id;
    const resourceLinkId = launchToken.platformContext.resource?.id;
    const courseMetadata = await loadMoodleCourseMetadata(externalCourseId);
    const synchronized = await ltiLaunchSyncService.synchronize(
      launchToken,
      courseMetadata,
    );
    const targetPath = synchronized.assignmentId
      ? `assignments/${synchronized.assignmentId}`
      : "dashboard";
    const frontendUrl = new URL(`${process.env.FRONTEND_URL}/${targetPath}`);

    frontendUrl.searchParams.set("ltik", res.locals.ltik);
    frontendUrl.searchParams.set("courseId", synchronized.courseId);
    frontendUrl.searchParams.set("userId", synchronized.userId);

    if (resourceLinkId) {
      frontendUrl.searchParams.set("resourceId", resourceLinkId);
    }

    return res.redirect(frontendUrl.toString());
  } catch (err) {
    if (err instanceof LtiRoleConflictError) {
      return res.status(403).send({
        success: false,
        message:
          "Your Moodle role conflicts with the global role stored in CheckHit.",
      });
    }

    if (err instanceof LtiLaunchDataError) {
      return res.status(400).send({
        success: false,
        message: err.message,
      });
    }

    const error = err as {
      message: string;
      response?: { body?: unknown };
    };
    console.error("שגיאה בעדכון הציון:", error.message);

    // התוספת הקריטית לדיבאגינג:
    if (error.response && error.response.body) {
      console.error("תוכן השגיאה המלא שהתקבל מהשרת:", error.response.body);
    }

    return res.status(500).send({ success: false, error: error.message });
  }
};
