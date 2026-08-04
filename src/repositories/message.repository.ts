import { DataSource, In, Repository } from "typeorm";
import { AppDataSource } from "../database/data-source.js";
import { Course } from "../entities/course.js";
import { Enrollment } from "../entities/enrollment.js";
import { MembershipStatus, MessageTargetType } from "../entities/enums.js";
import { MessageRecipient } from "../entities/message-recipient.js";
import { Message } from "../entities/message.js";
import { User } from "../entities/user.js";

export class MessageNotFoundError extends Error {
  constructor(messageId: string) {
    super(`Message with ID ${messageId} was not found`);
    this.name = "MessageNotFoundError";
  }
}

export class MessageUserNotFoundError extends Error {
  constructor(userId: string) {
    super(`User with ID ${userId} was not found`);
    this.name = "MessageUserNotFoundError";
  }
}

export class MessageCourseNotFoundError extends Error {
  constructor(courseId: string) {
    super(`Course with ID ${courseId} was not found`);
    this.name = "MessageCourseNotFoundError";
  }
}

export class MessageInvalidRecipientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MessageInvalidRecipientError";
  }
}

export interface FindUserMessagesOptions {
  folder?: "inbox" | "sent" | "archive";
  targetType?: "DIRECT" | "BROADCAST" | "SYSTEM" | "ALL";
  courseId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateMessageInput {
  senderId: string;
  targetType?: MessageTargetType;
  recipientId?: string;
  courseId?: string | null;
  subject: string;
  content: string;
  isPriority?: boolean;
}

export interface CreateReplyInput {
  parentMessageId: string;
  senderId: string;
  content: string;
}

export interface PaginatedMessagesResult {
  messages: Message[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
}

export class MessageRepository {
  private messageRepo: Repository<Message>;
  private recipientRepo: Repository<MessageRecipient>;
  private userRepo: Repository<User>;
  private courseRepo: Repository<Course>;
  private enrollmentRepo: Repository<Enrollment>;
  private dataSource: DataSource;

  constructor(dataSource: DataSource = AppDataSource) {
    this.dataSource = dataSource;
    this.messageRepo = dataSource.getRepository(Message);
    this.recipientRepo = dataSource.getRepository(MessageRecipient);
    this.userRepo = dataSource.getRepository(User);
    this.courseRepo = dataSource.getRepository(Course);
    this.enrollmentRepo = dataSource.getRepository(Enrollment);
  }

  /**
   * Helper to derive snippet from content
   */
  private generateSnippet(content: string, maxLength = 120): string {
    if (!content) return "";
    const clean = content.replace(/\r\n|\n|\r/g, " ").trim();
    if (clean.length <= maxLength) return clean;
    return clean.slice(0, maxLength).trim() + "...";
  }

  /**
   * Query messages for a user with folder, search, filter and pagination
   */
  async findUserMessages(
    userId: string,
    options: FindUserMessagesOptions = {},
  ): Promise<PaginatedMessagesResult> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new MessageUserNotFoundError(userId);
    }

    const folder = options.folder ?? "inbox";
    const targetType = options.targetType ?? "ALL";
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(options.limit) || 20));
    const skip = (page - 1) * limit;

    const unreadCount = await this.countUnread(userId);

    const qb = this.messageRepo
      .createQueryBuilder("m")
      .leftJoinAndSelect("m.sender", "sender")
      .leftJoinAndSelect("m.course", "course")
      .where("m.parentMessageId IS NULL");

    if (folder === "sent") {
      qb.andWhere("m.senderId = :userId", { userId });
      qb.andWhere("m.isDeletedBySender = false");
    } else if (folder === "archive") {
      qb.innerJoin(
        MessageRecipient,
        "mr",
        "mr.messageId = m.id AND mr.recipientId = :userId",
        { userId },
      );
      qb.andWhere("mr.isArchived = true");
      qb.andWhere("mr.isDeleted = false");
    } else {
      // Inbox
      qb.innerJoin(
        MessageRecipient,
        "mr",
        "mr.messageId = m.id AND mr.recipientId = :userId",
        { userId },
      );
      qb.andWhere("mr.isArchived = false");
      qb.andWhere("mr.isDeleted = false");
    }

    if (targetType && targetType !== "ALL") {
      qb.andWhere("m.targetType = :targetType", { targetType });
    }

    if (options.courseId) {
      qb.andWhere("m.courseId = :courseId", { courseId: options.courseId });
    }

    if (options.search && options.search.trim().length > 0) {
      const term = `%${options.search.trim().toLowerCase()}%`;
      qb.andWhere(
        "(LOWER(m.subject) LIKE :term OR LOWER(m.content) LIKE :term OR LOWER(sender.name) LIKE :term OR LOWER(course.name) LIKE :term)",
        { term },
      );
    }

    qb.orderBy("m.createdAt", "DESC");

    const total = await qb.getCount();
    qb.skip(skip).take(limit);
    const rawMessages = await qb.getMany();

    if (rawMessages.length === 0) {
      return {
        messages: [],
        total,
        unreadCount,
        page,
        limit,
      };
    }

    const messageIds = rawMessages.map((m) => m.id);

    // Fetch recipient stats and user-specific recipient rows for these messages
    const allRecipients = await this.recipientRepo.find({
      where: { messageId: In(messageIds) },
      relations: { recipient: true },
    });

    // Fetch replies counts
    const repliesCountsRaw = await this.messageRepo
      .createQueryBuilder("r")
      .select("r.parentMessageId", "parentMessageId")
      .addSelect("COUNT(r.id)", "count")
      .where("r.parentMessageId IN (:...messageIds)", { messageIds })
      .groupBy("r.parentMessageId")
      .getRawMany();

    const repliesCountMap = new Map<string, number>();
    for (const r of repliesCountsRaw) {
      repliesCountMap.set(r.parentMessageId, Number(r.count));
    }

    const recipientsMap = new Map<string, MessageRecipient[]>();
    for (const rec of allRecipients) {
      if (!recipientsMap.has(rec.messageId)) {
        recipientsMap.set(rec.messageId, []);
      }
      recipientsMap.get(rec.messageId)!.push(rec);
    }

    const enrichedMessages: Message[] = rawMessages.map((msg) => {
      const msgRecipients = recipientsMap.get(msg.id) ?? [];
      const userRecipient = msgRecipients.find((r) => r.recipientId === userId);

      const isSentByMe = msg.senderId === userId;
      const isRead = userRecipient ? userRecipient.isRead : true;
      const readAt = userRecipient ? userRecipient.readAt : null;
      const isArchived = userRecipient ? userRecipient.isArchived : false;
      const recipientCount = msgRecipients.length;
      const readCount = msgRecipients.filter((r) => r.isRead).length;
      const repliesCount = repliesCountMap.get(msg.id) ?? 0;

      msg.snippet = this.generateSnippet(msg.content);
      msg.isSentByMe = isSentByMe;
      msg.isRead = isRead;
      msg.readAt = readAt;
      msg.isArchived = isArchived;
      msg.recipientCount = recipientCount;
      msg.readCount = readCount;
      msg.repliesCount = repliesCount;

      return msg;
    });

    return {
      messages: enrichedMessages,
      total,
      unreadCount,
      page,
      limit,
    };
  }

  /**
   * Find single message with full reply thread and recipient details
   */
  async findMessageById(messageId: string, userId?: string): Promise<Message> {
    const message = await this.messageRepo.findOne({
      where: { id: messageId },
      relations: {
        sender: true,
        course: true,
        recipients: { recipient: true },
      },
    });

    if (!message) {
      throw new MessageNotFoundError(messageId);
    }

    // If message is a reply, we can load root parent or treat it directly
    const rootId = message.parentMessageId || message.id;

    // Load full chronological replies
    const replies = await this.messageRepo.find({
      where: { parentMessageId: rootId },
      relations: { sender: true },
      order: { createdAt: "ASC" },
    });

    message.replies = replies;

    // Populate delivery stats
    const recipients = message.recipients || [];
    message.recipientCount = recipients.length;
    message.readCount = recipients.filter((r) => r.isRead).length;
    message.repliesCount = replies.length;
    message.snippet = this.generateSnippet(message.content);

    if (userId) {
      const userRecipient = recipients.find((r) => r.recipientId === userId);
      message.isSentByMe = message.senderId === userId;
      message.isRead = userRecipient ? userRecipient.isRead : true;
      message.readAt = userRecipient ? userRecipient.readAt : null;
      message.isArchived = userRecipient ? userRecipient.isArchived : false;
    }

    return message;
  }

  /**
   * Create a new message (Direct or Broadcast)
   */
  async createMessage(data: CreateMessageInput): Promise<Message> {
    const sender = await this.userRepo.findOne({
      where: { id: data.senderId },
    });
    if (!sender) {
      throw new MessageUserNotFoundError(data.senderId);
    }

    const targetType = data.targetType ?? MessageTargetType.DIRECT;

    if (data.courseId) {
      const course = await this.courseRepo.findOne({
        where: { id: data.courseId },
      });
      if (!course) {
        throw new MessageCourseNotFoundError(data.courseId);
      }
    }

    if (targetType === MessageTargetType.BROADCAST) {
      if (!data.courseId) {
        throw new MessageInvalidRecipientError(
          "Course ID is required for BROADCAST messages",
        );
      }
      return this.createCourseBroadcast(data);
    }

    if (targetType === MessageTargetType.DIRECT) {
      if (!data.recipientId) {
        throw new MessageInvalidRecipientError(
          "Recipient ID is required for DIRECT messages",
        );
      }
      return this.createDirectMessage(data);
    }

    // SYSTEM messages
    return this.createSystemMessage(data);
  }

  /**
   * Create direct 1:1 message
   */
  private async createDirectMessage(data: CreateMessageInput): Promise<Message> {
    const recipient = await this.userRepo.findOne({
      where: { id: data.recipientId },
    });
    if (!recipient) {
      throw new MessageUserNotFoundError(data.recipientId!);
    }

    return this.dataSource.transaction(async (manager) => {
      const message = manager.create(Message, {
        senderId: data.senderId,
        courseId: data.courseId ?? null,
        targetType: MessageTargetType.DIRECT,
        subject: data.subject,
        content: data.content,
        isPriority: data.isPriority ?? false,
      });

      const savedMessage = await manager.save(Message, message);

      const recipientRecord = manager.create(MessageRecipient, {
        messageId: savedMessage.id,
        recipientId: recipient.id,
        isRead: false,
      });

      await manager.save(MessageRecipient, recipientRecord);

      savedMessage.sender = (await manager.findOne(User, {
        where: { id: data.senderId },
      }))!;
      if (savedMessage.courseId) {
        savedMessage.course = await manager.findOne(Course, {
          where: { id: savedMessage.courseId },
        });
      }
      savedMessage.recipientCount = 1;
      savedMessage.readCount = 0;
      savedMessage.repliesCount = 0;
      savedMessage.isSentByMe = true;
      savedMessage.snippet = this.generateSnippet(savedMessage.content);

      return savedMessage;
    });
  }

  /**
   * Create 1:N course broadcast (fans out to all active enrolled students)
   */
  private async createCourseBroadcast(
    data: CreateMessageInput,
  ): Promise<Message> {
    const courseId = data.courseId!;

    const activeEnrollments = await this.enrollmentRepo.find({
      where: {
        courseId,
        status: MembershipStatus.ACTIVE,
      },
    });

    return this.dataSource.transaction(async (manager) => {
      const message = manager.create(Message, {
        senderId: data.senderId,
        courseId,
        targetType: MessageTargetType.BROADCAST,
        subject: data.subject,
        content: data.content,
        isPriority: data.isPriority ?? false,
      });

      const savedMessage = await manager.save(Message, message);

      if (activeEnrollments.length > 0) {
        const recipientRecords = activeEnrollments.map((enr) =>
          manager.create(MessageRecipient, {
            messageId: savedMessage.id,
            recipientId: enr.studentId,
            isRead: false,
          }),
        );

        await manager.save(MessageRecipient, recipientRecords);
      }

      savedMessage.sender = (await manager.findOne(User, {
        where: { id: data.senderId },
      }))!;
      savedMessage.course = await manager.findOne(Course, {
        where: { id: courseId },
      });
      savedMessage.recipientCount = activeEnrollments.length;
      savedMessage.readCount = 0;
      savedMessage.repliesCount = 0;
      savedMessage.isSentByMe = true;
      savedMessage.snippet = this.generateSnippet(savedMessage.content);

      return savedMessage;
    });
  }

  /**
   * Create SYSTEM broadcast/message
   */
  private async createSystemMessage(data: CreateMessageInput): Promise<Message> {
    return this.dataSource.transaction(async (manager) => {
      const message = manager.create(Message, {
        senderId: data.senderId,
        courseId: data.courseId ?? null,
        targetType: MessageTargetType.SYSTEM,
        subject: data.subject,
        content: data.content,
        isPriority: data.isPriority ?? false,
      });

      const savedMessage = await manager.save(Message, message);

      if (data.recipientId) {
        const recipientRecord = manager.create(MessageRecipient, {
          messageId: savedMessage.id,
          recipientId: data.recipientId,
          isRead: false,
        });
        await manager.save(MessageRecipient, recipientRecord);
        savedMessage.recipientCount = 1;
      } else {
        // If system announcement without specific recipient, deliver to all users
        const allUsers = await manager.find(User);
        const recipientRecords = allUsers.map((u) =>
          manager.create(MessageRecipient, {
            messageId: savedMessage.id,
            recipientId: u.id,
            isRead: false,
          }),
        );
        await manager.save(MessageRecipient, recipientRecords);
        savedMessage.recipientCount = allUsers.length;
      }

      savedMessage.sender = (await manager.findOne(User, {
        where: { id: data.senderId },
      }))!;
      savedMessage.readCount = 0;
      savedMessage.repliesCount = 0;
      savedMessage.isSentByMe = true;
      savedMessage.snippet = this.generateSnippet(savedMessage.content);

      return savedMessage;
    });
  }

  /**
   * Post a reply to an existing message thread
   */
  async createReply(data: CreateReplyInput): Promise<Message> {
    const parent = await this.messageRepo.findOne({
      where: { id: data.parentMessageId },
      relations: {
        sender: true,
        course: true,
        recipients: true,
      },
    });

    if (!parent) {
      throw new MessageNotFoundError(data.parentMessageId);
    }

    const sender = await this.userRepo.findOne({
      where: { id: data.senderId },
    });
    if (!sender) {
      throw new MessageUserNotFoundError(data.senderId);
    }

    // Attach to root if parent was itself a reply
    const rootParentId = parent.parentMessageId || parent.id;

    const reply = this.messageRepo.create({
      senderId: data.senderId,
      courseId: parent.courseId,
      targetType: parent.targetType,
      subject: parent.subject.startsWith("Re:")
        ? parent.subject
        : `Re: ${parent.subject}`,
      content: data.content,
      isPriority: false,
      parentMessageId: rootParentId,
    });

    const savedReply = await this.messageRepo.save(reply);
    savedReply.sender = sender;
    savedReply.course = parent.course;
    savedReply.snippet = this.generateSnippet(savedReply.content);

    return savedReply;
  }

  /**
   * Mark message as read / unread for a specific recipient
   */
  async updateReadStatus(
    messageId: string,
    userId: string,
    isRead: boolean,
  ): Promise<{ messageId: string; isRead: boolean; readAt: Date | null }> {
    const recipient = await this.recipientRepo.findOne({
      where: { messageId, recipientId: userId },
    });

    if (!recipient) {
      throw new MessageNotFoundError(
        `Recipient record for message ${messageId} and user ${userId} was not found`,
      );
    }

    recipient.isRead = isRead;
    recipient.readAt = isRead ? new Date() : null;
    await this.recipientRepo.save(recipient);

    return {
      messageId,
      isRead: recipient.isRead,
      readAt: recipient.readAt,
    };
  }

  /**
   * Mark message as archived / unarchived for a specific recipient
   */
  async updateArchiveStatus(
    messageId: string,
    userId: string,
    isArchived: boolean,
  ): Promise<{ messageId: string; isArchived: boolean }> {
    const recipient = await this.recipientRepo.findOne({
      where: { messageId, recipientId: userId },
    });

    if (!recipient) {
      throw new MessageNotFoundError(
        `Recipient record for message ${messageId} and user ${userId} was not found`,
      );
    }

    recipient.isArchived = isArchived;
    await this.recipientRepo.save(recipient);

    return {
      messageId,
      isArchived: recipient.isArchived,
    };
  }

  /**
   * Soft delete message for a user (either recipient or sender)
   */
  async softDeleteMessage(messageId: string, userId: string): Promise<boolean> {
    // Check if user is recipient
    const recipient = await this.recipientRepo.findOne({
      where: { messageId, recipientId: userId },
    });

    let affected = false;

    if (recipient) {
      recipient.isDeleted = true;
      await this.recipientRepo.save(recipient);
      affected = true;
    }

    // Check if user is sender
    const message = await this.messageRepo.findOne({
      where: { id: messageId, senderId: userId },
    });

    if (message) {
      message.isDeletedBySender = true;
      await this.messageRepo.save(message);
      affected = true;
    }

    return affected;
  }

  /**
   * Count unread messages for a user
   */
  async countUnread(userId: string): Promise<number> {
    return this.recipientRepo.count({
      where: {
        recipientId: userId,
        isRead: false,
        isDeleted: false,
      },
    });
  }
}
