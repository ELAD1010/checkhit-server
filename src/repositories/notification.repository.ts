import { DataSource, Repository } from "typeorm";
import { AppDataSource } from "../database/data-source.js";
import { NotificationCategory } from "../entities/enums.js";
import { Notification } from "../entities/notification.js";
import { User } from "../entities/user.js";

export class NotificationUserNotFoundError extends Error {
  constructor(userId: string) {
    super(`User with ID ${userId} was not found`);
    this.name = "NotificationUserNotFoundError";
  }
}

export class NotificationNotFoundError extends Error {
  constructor(notificationId: string) {
    super(`Notification with ID ${notificationId} was not found`);
    this.name = "NotificationNotFoundError";
  }
}

export interface CreateNotificationInput {
  recipientId: string;
  title: string;
  body: string;
  category: NotificationCategory;
  isRead?: boolean;
  link?: string | null;
  metadata?: Record<string, unknown> | null;
  readAt?: Date | null;
}

export interface FindNotificationsOptions {
  unreadOnly?: boolean;
  limit?: number;
}

export class NotificationRepository {
  private notificationRepo: Repository<Notification>;
  private userRepo: Repository<User>;

  constructor(dataSource: DataSource = AppDataSource) {
    this.notificationRepo = dataSource.getRepository(Notification);
    this.userRepo = dataSource.getRepository(User);
  }

  async findByRecipient(
    recipientId: string,
    options?: FindNotificationsOptions,
  ): Promise<Notification[]> {
    const user = await this.userRepo.findOne({
      where: { id: recipientId },
    });

    if (!user) {
      throw new NotificationUserNotFoundError(recipientId);
    }

    const where: { recipientId: string; isRead?: boolean } = { recipientId };
    if (options?.unreadOnly) {
      where.isRead = false;
    }

    return this.notificationRepo.find({
      where,
      order: {
        createdAt: "DESC",
      },
      ...(options?.limit && options.limit > 0 ? { take: options.limit } : {}),
    });
  }

  async countUnread(recipientId: string): Promise<number> {
    const user = await this.userRepo.findOne({
      where: { id: recipientId },
    });

    if (!user) {
      throw new NotificationUserNotFoundError(recipientId);
    }

    return this.notificationRepo.count({
      where: {
        recipientId,
        isRead: false,
      },
    });
  }

  async markAsRead(notificationId: string): Promise<Notification> {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotificationNotFoundError(notificationId);
    }

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      return this.notificationRepo.save(notification);
    }

    return notification;
  }

  async markAllAsRead(recipientId: string): Promise<number> {
    const user = await this.userRepo.findOne({
      where: { id: recipientId },
    });

    if (!user) {
      throw new NotificationUserNotFoundError(recipientId);
    }

    const result = await this.notificationRepo.update(
      {
        recipientId,
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      },
    );

    return result.affected ?? 0;
  }

  async createNotification(
    data: CreateNotificationInput,
  ): Promise<Notification> {
    const user = await this.userRepo.findOne({
      where: { id: data.recipientId },
    });

    if (!user) {
      throw new NotificationUserNotFoundError(data.recipientId);
    }

    const notification = this.notificationRepo.create({
      recipientId: data.recipientId,
      title: data.title,
      body: data.body,
      category: data.category,
      isRead: data.isRead ?? false,
      link: data.link ?? null,
      metadata: data.metadata ?? null,
      readAt: data.readAt ?? (data.isRead ? new Date() : null),
    });

    return this.notificationRepo.save(notification);
  }

  async deleteNotification(notificationId: string): Promise<boolean> {
    const result = await this.notificationRepo.delete({ id: notificationId });
    return (result.affected ?? 0) > 0;
  }
}
