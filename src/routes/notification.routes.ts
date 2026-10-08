import { Router } from "express";
import {
  getUnreadCount,
  getUserNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  streamUserNotifications,
} from "../controllers/notification.controller.js";
import { accessControl } from "../middleware/access-control.js";

export const notificationRouter = Router();
const { requireIdentity, requireSelf } = accessControl;

/**
 * @openapi
 * /users/{userId}/notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Get notifications for a user (student or lecturer)
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         description: User ID (student or lecturer)
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: unreadOnly
 *         required: false
 *         description: Filter only unread notifications
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: limit
 *         required: false
 *         description: Maximum number of notifications to return
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Array of notifications ordered by creation date descending
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Notification'
 *       400:
 *         description: Invalid user ID
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
notificationRouter.get(
  "/users/:userId/notifications",
  requireIdentity,
  requireSelf("userId"),
  getUserNotifications,
);

/**
 * @openapi
 * /users/{userId}/notifications/stream:
 *   get:
 *     tags: [Notifications]
 *     summary: Stream new notifications and read-state changes using Server-Sent Events
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: text/event-stream containing notification, notification-read, and notifications-read-all events
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 */
notificationRouter.get(
  "/users/:userId/notifications/stream",
  requireIdentity,
  requireSelf("userId"),
  streamUserNotifications,
);

/**
 * @openapi
 * /users/{userId}/notifications/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: Get count of unread notifications for a user
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         description: User ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Unread notification count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 unreadCount:
 *                   type: integer
 *       400:
 *         description: Invalid user ID
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
notificationRouter.get(
  "/users/:userId/notifications/unread-count",
  requireIdentity,
  requireSelf("userId"),
  getUnreadCount,
);

/**
 * @openapi
 * /notifications/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark a single notification as read
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Notification ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Updated notification
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Notification'
 *       400:
 *         description: Invalid notification ID
 *       404:
 *         description: Notification not found
 *       500:
 *         description: Server error
 */
notificationRouter.patch(
  "/notifications/:id/read",
  requireIdentity,
  markNotificationAsRead,
);

/**
 * @openapi
 * /users/{userId}/notifications/read-all:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark all notifications for a user as read
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         description: User ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Success status and updated count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 updatedCount:
 *                   type: integer
 *       400:
 *         description: Invalid user ID
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
notificationRouter.patch(
  "/users/:userId/notifications/read-all",
  requireIdentity,
  requireSelf("userId"),
  markAllNotificationsAsRead,
);
