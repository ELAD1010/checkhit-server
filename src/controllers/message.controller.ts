import { Request, Response } from "express";
import { MessageTargetType } from "../entities/enums.js";
import {
  MessageCourseNotFoundError,
  MessageInvalidRecipientError,
  MessageNotFoundError,
  MessageRepository,
  MessageUserNotFoundError,
} from "../repositories/message.repository.js";
import { isUuid } from "./user-controller.utils.js";

const messageRepository = new MessageRepository();

const extractUserId = (req: Request): string | undefined => {
  if (typeof req.params.userId === "string" && isUuid(req.params.userId)) {
    return req.params.userId;
  }
  if (typeof req.query.userId === "string" && isUuid(req.query.userId)) {
    return req.query.userId;
  }
  const headerUserId = req.headers["x-user-id"];
  if (typeof headerUserId === "string" && isUuid(headerUserId)) {
    return headerUserId;
  }
  if (req.body && typeof req.body.userId === "string" && isUuid(req.body.userId)) {
    return req.body.userId;
  }
  if (req.body && typeof req.body.senderId === "string" && isUuid(req.body.senderId)) {
    return req.body.senderId;
  }
  return undefined;
};

export const getMessages = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = extractUserId(req);

  if (!userId || !isUuid(userId)) {
    res
      .status(400)
      .json({ message: "A valid user ID is required in query, header, or param" });
    return;
  }

  const folder =
    req.query.folder === "sent" || req.query.folder === "archive"
      ? req.query.folder
      : "inbox";

  const targetType =
    req.query.targetType === "DIRECT" ||
    req.query.targetType === "BROADCAST" ||
    req.query.targetType === "SYSTEM"
      ? req.query.targetType
      : "ALL";

  const courseId =
    typeof req.query.courseId === "string" && req.query.courseId.trim().length > 0
      ? req.query.courseId
      : undefined;

  const search =
    typeof req.query.search === "string" && req.query.search.trim().length > 0
      ? req.query.search.trim()
      : undefined;

  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 20;

  try {
    const result = await messageRepository.findUserMessages(userId, {
      folder,
      targetType,
      courseId,
      search,
      page,
      limit,
    });

    const formattedMessages = result.messages.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      sender: m.sender
        ? {
            id: m.sender.id,
            name: m.sender.name,
            email: m.sender.email,
            role: m.sender.role,
          }
        : undefined,
      targetType: m.targetType,
      courseId: m.courseId,
      courseCode: m.course ? m.course.name.split(/[:\s]/)[0] : undefined,
      courseName: m.course ? m.course.name : undefined,
      subject: m.subject,
      snippet: m.snippet,
      content: m.content,
      isPriority: m.isPriority,
      isRead: m.isRead,
      readAt: m.readAt,
      isArchived: m.isArchived,
      isSentByMe: m.isSentByMe,
      recipientCount: m.recipientCount,
      readCount: m.readCount,
      repliesCount: m.repliesCount,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));

    res.json({
      messages: formattedMessages,
      total: result.total,
      unreadCount: result.unreadCount,
      page: result.page,
      limit: result.limit,
    });
  } catch (error) {
    if (error instanceof MessageUserNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    console.error("Failed to fetch messages:", error);
    res.status(500).json({ message: "Failed to fetch messages" });
  }
};

export const getMessageById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const id = typeof req.params.id === "string" ? req.params.id : undefined;

  if (!id || !isUuid(id)) {
    res.status(400).json({ message: "A valid message ID is required" });
    return;
  }

  const userId = extractUserId(req);

  try {
    const message = await messageRepository.findMessageById(id, userId);

    const formattedMessage = {
      id: message.id,
      senderId: message.senderId,
      sender: message.sender
        ? {
            id: message.sender.id,
            name: message.sender.name,
            email: message.sender.email,
            role: message.sender.role,
          }
        : undefined,
      targetType: message.targetType,
      courseId: message.courseId,
      courseCode: message.course ? message.course.name.split(/[:\s]/)[0] : undefined,
      courseName: message.course ? message.course.name : undefined,
      subject: message.subject,
      snippet: message.snippet,
      content: message.content,
      isPriority: message.isPriority,
      isRead: message.isRead,
      readAt: message.readAt,
      isArchived: message.isArchived,
      isSentByMe: message.isSentByMe,
      recipientCount: message.recipientCount,
      readCount: message.readCount,
      repliesCount: message.repliesCount,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      replies: (message.replies || []).map((rep) => ({
        id: rep.id,
        messageId: message.id,
        senderId: rep.senderId,
        sender: rep.sender
          ? {
              id: rep.sender.id,
              name: rep.sender.name,
              email: rep.sender.email,
              role: rep.sender.role,
            }
          : undefined,
        content: rep.content,
        isMe: userId ? rep.senderId === userId : undefined,
        createdAt: rep.createdAt,
      })),
    };

    res.json(formattedMessage);
  } catch (error) {
    if (error instanceof MessageNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    console.error("Failed to fetch message by ID:", error);
    res.status(500).json({ message: "Failed to fetch message" });
  }
};

export const createMessage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const {
    senderId,
    targetType,
    courseId,
    recipientId,
    subject,
    content,
    isPriority,
  } = req.body;

  if (!senderId || !isUuid(senderId)) {
    res.status(400).json({ message: "A valid senderId is required" });
    return;
  }

  if (!subject || typeof subject !== "string" || subject.trim().length === 0) {
    res.status(400).json({ message: "A non-empty subject is required" });
    return;
  }

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    res.status(400).json({ message: "A non-empty content is required" });
    return;
  }

  const parsedTargetType: MessageTargetType =
    targetType === "BROADCAST"
      ? MessageTargetType.BROADCAST
      : targetType === "SYSTEM"
        ? MessageTargetType.SYSTEM
        : MessageTargetType.DIRECT;

  if (parsedTargetType === MessageTargetType.BROADCAST && (!courseId || !isUuid(courseId))) {
    res.status(400).json({ message: "A valid courseId is required for course broadcast" });
    return;
  }

  if (parsedTargetType === MessageTargetType.DIRECT && (!recipientId || !isUuid(recipientId))) {
    res.status(400).json({ message: "A valid recipientId is required for direct message" });
    return;
  }

  try {
    const created = await messageRepository.createMessage({
      senderId,
      targetType: parsedTargetType,
      courseId,
      recipientId,
      subject: subject.trim(),
      content: content.trim(),
      isPriority: Boolean(isPriority),
    });

    res.status(201).json(created);
  } catch (error) {
    if (
      error instanceof MessageUserNotFoundError ||
      error instanceof MessageCourseNotFoundError
    ) {
      res.status(404).json({ message: error.message });
      return;
    }
    if (error instanceof MessageInvalidRecipientError) {
      res.status(400).json({ message: error.message });
      return;
    }

    console.error("Failed to create message:", error);
    res.status(500).json({ message: "Failed to create message" });
  }
};

export const createReply = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const id = typeof req.params.id === "string" ? req.params.id : undefined;

  if (!id || !isUuid(id)) {
    res.status(400).json({ message: "A valid parent message ID is required" });
    return;
  }

  const { senderId, content } = req.body;

  if (!senderId || !isUuid(senderId)) {
    res.status(400).json({ message: "A valid senderId is required" });
    return;
  }

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    res.status(400).json({ message: "A non-empty content is required" });
    return;
  }

  try {
    const reply = await messageRepository.createReply({
      parentMessageId: id,
      senderId,
      content: content.trim(),
    });

    res.status(201).json({
      id: reply.id,
      messageId: id,
      senderId: reply.senderId,
      sender: reply.sender
        ? {
            id: reply.sender.id,
            name: reply.sender.name,
            email: reply.sender.email,
            role: reply.sender.role,
          }
        : undefined,
      content: reply.content,
      createdAt: reply.createdAt,
    });
  } catch (error) {
    if (
      error instanceof MessageNotFoundError ||
      error instanceof MessageUserNotFoundError
    ) {
      res.status(404).json({ message: error.message });
      return;
    }

    console.error("Failed to create reply:", error);
    res.status(500).json({ message: "Failed to create reply" });
  }
};

export const markAsRead = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const id = typeof req.params.id === "string" ? req.params.id : undefined;

  if (!id || !isUuid(id)) {
    res.status(400).json({ message: "A valid message ID is required" });
    return;
  }

  const userId = extractUserId(req);

  if (!userId || !isUuid(userId)) {
    res.status(400).json({ message: "A valid user ID is required" });
    return;
  }

  const isRead = req.body.isRead !== false;

  try {
    const result = await messageRepository.updateReadStatus(id, userId, isRead);
    res.json({
      success: true,
      messageId: result.messageId,
      isRead: result.isRead,
      readAt: result.readAt,
    });
  } catch (error) {
    if (error instanceof MessageNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    console.error("Failed to mark message as read:", error);
    res.status(500).json({ message: "Failed to mark message as read" });
  }
};

export const markAsArchived = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const id = typeof req.params.id === "string" ? req.params.id : undefined;

  if (!id || !isUuid(id)) {
    res.status(400).json({ message: "A valid message ID is required" });
    return;
  }

  const userId = extractUserId(req);

  if (!userId || !isUuid(userId)) {
    res.status(400).json({ message: "A valid user ID is required" });
    return;
  }

  const isArchived = req.body.isArchived !== false;

  try {
    const result = await messageRepository.updateArchiveStatus(
      id,
      userId,
      isArchived,
    );
    res.json({
      success: true,
      messageId: result.messageId,
      isArchived: result.isArchived,
    });
  } catch (error) {
    if (error instanceof MessageNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    console.error("Failed to update message archive status:", error);
    res.status(500).json({ message: "Failed to update archive status" });
  }
};

export const deleteMessage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const id = typeof req.params.id === "string" ? req.params.id : undefined;

  if (!id || !isUuid(id)) {
    res.status(400).json({ message: "A valid message ID is required" });
    return;
  }

  const userId = extractUserId(req);

  if (!userId || !isUuid(userId)) {
    res.status(400).json({ message: "A valid user ID is required" });
    return;
  }

  try {
    const success = await messageRepository.softDeleteMessage(id, userId);
    if (!success) {
      res.status(404).json({ message: "Message or recipient entry not found" });
      return;
    }
    res.json({ success: true, message: "Message removed from inbox" });
  } catch (error) {
    console.error("Failed to delete message:", error);
    res.status(500).json({ message: "Failed to delete message" });
  }
};

export const getUnreadCount = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = extractUserId(req);

  if (!userId || !isUuid(userId)) {
    res.status(400).json({ message: "A valid user ID is required" });
    return;
  }

  try {
    const unreadCount = await messageRepository.countUnread(userId);
    res.json({ unreadCount });
  } catch (error) {
    console.error("Failed to get unread messages count:", error);
    res.status(500).json({ message: "Failed to get unread messages count" });
  }
};
