import { Router } from "express";
import {
  createMessage,
  createReply,
  deleteMessage,
  getMessageById,
  getMessages,
  getUnreadCount,
  markAsArchived,
  markAsRead,
} from "../controllers/message.controller.js";

export const messageRouter = Router();

/**
 * @openapi
 * /messages/unread-count:
 *   get:
 *     tags: [Messages]
 *     summary: Get unread messages count for navbar badges
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: false
 *         description: User ID
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: header
 *         name: x-user-id
 *         required: false
 *         description: User ID header
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Unread count response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageUnreadCountResponse'
 *       400:
 *         description: Missing or invalid user ID
 *       500:
 *         description: Server error
 */
messageRouter.get("/messages/unread-count", getUnreadCount);

/**
 * @openapi
 * /messages:
 *   get:
 *     tags: [Messages]
 *     summary: List messages for a user (inbox, sent, or archive)
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: false
 *         description: User ID
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: header
 *         name: x-user-id
 *         required: false
 *         description: User ID header
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: folder
 *         required: false
 *         description: Message folder
 *         schema:
 *           type: string
 *           enum: [inbox, sent, archive]
 *           default: inbox
 *       - in: query
 *         name: targetType
 *         required: false
 *         description: Target type filter
 *         schema:
 *           type: string
 *           enum: [DIRECT, BROADCAST, SYSTEM, ALL]
 *           default: ALL
 *       - in: query
 *         name: courseId
 *         required: false
 *         description: Filter messages related to a specific course
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: search
 *         required: false
 *         description: Search matching subject, content, sender name, or course name
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         required: false
 *         description: Pagination page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         description: Pagination limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of messages with pagination and unread count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MessageSummary'
 *                 total:
 *                   type: integer
 *                 unreadCount:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *       400:
 *         description: Missing or invalid user ID
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
messageRouter.get("/messages", getMessages);

/**
 * @openapi
 * /messages/{id}:
 *   get:
 *     tags: [Messages]
 *     summary: Get message details along with complete reply thread
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Message ID
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: userId
 *         required: false
 *         description: Acting user ID for read/sent context
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: header
 *         name: x-user-id
 *         required: false
 *         description: Acting user ID header
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Message details with full threaded replies
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       400:
 *         description: Invalid message ID
 *       404:
 *         description: Message not found
 *       500:
 *         description: Server error
 */
messageRouter.get("/messages/:id", getMessageById);

/**
 * @openapi
 * /messages:
 *   post:
 *     tags: [Messages]
 *     summary: Create and dispatch a new direct message or course broadcast
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateMessageRequest'
 *     responses:
 *       201:
 *         description: Message created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       400:
 *         description: Invalid input or missing recipient/course
 *       404:
 *         description: Sender, recipient, or course not found
 *       500:
 *         description: Server error
 */
messageRouter.post("/messages", createMessage);

/**
 * @openapi
 * /messages/{id}/replies:
 *   post:
 *     tags: [Messages]
 *     summary: Post a reply to an existing message thread
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Parent Message ID
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateReplyRequest'
 *     responses:
 *       201:
 *         description: Reply created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageReply'
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Parent message or sender not found
 *       500:
 *         description: Server error
 */
messageRouter.post("/messages/:id/replies", createReply);

/**
 * @openapi
 * /messages/{id}/read:
 *   patch:
 *     tags: [Messages]
 *     summary: Mark a message as read or unread for a user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Message ID
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *               isRead:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Updated read status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 messageId:
 *                   type: string
 *                   format: uuid
 *                 isRead:
 *                   type: boolean
 *                 readAt:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *       400:
 *         description: Invalid input or missing user ID
 *       404:
 *         description: Message or recipient not found
 *       500:
 *         description: Server error
 */
messageRouter.patch("/messages/:id/read", markAsRead);

/**
 * @openapi
 * /messages/{id}/archive:
 *   patch:
 *     tags: [Messages]
 *     summary: Archive or unarchive a message for a user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Message ID
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *               isArchived:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Updated archive status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 messageId:
 *                   type: string
 *                   format: uuid
 *                 isArchived:
 *                   type: boolean
 *       400:
 *         description: Invalid input or missing user ID
 *       404:
 *         description: Message or recipient not found
 *       500:
 *         description: Server error
 */
messageRouter.patch("/messages/:id/archive", markAsArchived);

/**
 * @openapi
 * /messages/{id}:
 *   delete:
 *     tags: [Messages]
 *     summary: Soft delete a message for a user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Message ID
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: userId
 *         required: false
 *         description: User ID
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Soft deletion result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Missing or invalid user ID
 *       404:
 *         description: Message not found
 *       500:
 *         description: Server error
 */
messageRouter.delete("/messages/:id", deleteMessage);
