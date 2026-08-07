import { NextFunction, Request, Response } from "express";
import { UserRole } from "../entities/enums.js";
import {
  LtiLaunchDataError,
  LtiLaunchSyncService,
  LtiRoleConflictError,
  type LtiLaunchSyncResult,
} from "../services/lti-launch-sync.service.js";
import type { LtiToken } from "../common/types/lti.js";

export type AuthenticatedRequest = Request & {
  auth?: LtiLaunchSyncResult;
};

const ltiLaunchSyncService = new LtiLaunchSyncService();

export const requireLtiAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = res.locals.token as LtiToken | undefined;
    if (!token) {
      res.status(401).json({ message: "Missing LTI session" });
      return;
    }

    req.auth = await ltiLaunchSyncService.synchronize(token);
    next();
  } catch (error) {
    if (error instanceof LtiRoleConflictError) {
      res.status(403).json({
        message: "Moodle role conflicts with the stored global role",
      });
      return;
    }

    if (error instanceof LtiLaunchDataError) {
      res.status(400).json({ message: error.message });
      return;
    }

    console.error("Failed to authorize LTI request:", error);
    res.status(500).json({ message: "Failed to authorize request" });
  }
};

export const requireLecturer = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.auth) {
    res.status(401).json({ message: "Missing LTI session" });
    return;
  }

  if (req.auth.role !== UserRole.LECTURER) {
    res.status(403).json({ message: "Lecturer role required" });
    return;
  }

  next();
};

export const requireStudent = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.auth) {
    res.status(401).json({ message: "Missing LTI session" });
    return;
  }

  if (req.auth.role !== UserRole.STUDENT) {
    res.status(403).json({ message: "Student role required" });
    return;
  }

  next();
};
