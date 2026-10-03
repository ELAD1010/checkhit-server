import { Request, Response } from "express";
import {
  NotificationNotFoundError,
  NotificationRepository,
  NotificationUserNotFoundError,
} from "../repositories/notification.repository.js";
import { isUuid } from "./user-controller.utils.js";
import { notificationLiveService } from "../services/notification-live.service.js";

const notificationRepository = new NotificationRepository();

export const streamUserNotifications = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId =
    typeof req.params.userId === "string" ? req.params.userId : undefined;
  if (!userId || !isUuid(userId)) {
    res.status(400).json({ message: "A valid user ID is required" });
    return;
  }

  try {
    await notificationRepository.countUnread(userId);
  } catch (error) {
    if (error instanceof NotificationUserNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }
    throw error;
  }

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  res.write("event: connected\ndata: {}\n\n");

  const unsubscribe = notificationLiveService.subscribe(userId, res);
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 25_000);
  heartbeat.unref?.();
  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
};

export const getUserNotifications = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId =
    typeof req.params.userId === "string" ? req.params.userId : undefined;

  if (!userId || !isUuid(userId)) {
    res.status(400).json({ message: "A valid user ID is required" });
    return;
  }

  const unreadOnly = req.query.unreadOnly === "true";
  let limit: number | undefined;

  if (typeof req.query.limit === "string") {
    const parsedLimit = parseInt(req.query.limit, 10);
    if (!Number.isNaN(parsedLimit) && parsedLimit > 0) {
      limit = parsedLimit;
    }
  }

  try {
    const notifications = await notificationRepository.findByRecipient(userId, {
      unreadOnly,
      limit,
    });
    res.json(notifications);
  } catch (error) {
    if (error instanceof NotificationUserNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    console.error("Failed to fetch user notifications:", error);
    res.status(500).json({ message: "Failed to fetch user notifications" });
  }
};

export const getUnreadCount = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId =
    typeof req.params.userId === "string" ? req.params.userId : undefined;

  if (!userId || !isUuid(userId)) {
    res.status(400).json({ message: "A valid user ID is required" });
    return;
  }

  try {
    const unreadCount = await notificationRepository.countUnread(userId);
    res.json({ unreadCount });
  } catch (error) {
    if (error instanceof NotificationUserNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    console.error("Failed to fetch unread notifications count:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch unread notifications count" });
  }
};

export const markNotificationAsRead = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const id = typeof req.params.id === "string" ? req.params.id : undefined;

  if (!id || !isUuid(id)) {
    res.status(400).json({ message: "A valid notification ID is required" });
    return;
  }

  try {
    const notification = await notificationRepository.markAsRead(id);
    notificationLiveService.publishEvent(notification.recipientId, "notification-read", {
      notificationId: notification.id,
      readAt: notification.readAt,
    });
    res.json(notification);
  } catch (error) {
    if (error instanceof NotificationNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    console.error("Failed to mark notification as read:", error);
    res.status(500).json({ message: "Failed to mark notification as read" });
  }
};

export const markAllNotificationsAsRead = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId =
    typeof req.params.userId === "string" ? req.params.userId : undefined;

  if (!userId || !isUuid(userId)) {
    res.status(400).json({ message: "A valid user ID is required" });
    return;
  }

  try {
    const updatedCount = await notificationRepository.markAllAsRead(userId);
    notificationLiveService.publishEvent(userId, "notifications-read-all", {
      updatedCount,
      readAt: new Date(),
    });
    res.json({ success: true, updatedCount });
  } catch (error) {
    if (error instanceof NotificationUserNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    console.error("Failed to mark all notifications as read:", error);
    res
      .status(500)
      .json({ message: "Failed to mark all notifications as read" });
  }
};
