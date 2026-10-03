import type { Response } from "express";
import type { Notification } from "../entities/notification.js";

export class NotificationLiveService {
  private readonly clients = new Map<string, Set<Response>>();

  subscribe(userId: string, response: Response): () => void {
    const responses = this.clients.get(userId) ?? new Set<Response>();
    responses.add(response);
    this.clients.set(userId, responses);

    return () => {
      responses.delete(response);
      if (responses.size === 0) this.clients.delete(userId);
    };
  }

  publish(notification: Notification): void {
    this.publishEvent(notification.recipientId, "notification", notification);
  }

  publishEvent(userId: string, event: string, data: unknown): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const responses = this.clients.get(userId);
    for (const response of responses ?? []) {
      try {
        response.write(payload);
      } catch {
        responses?.delete(response);
      }
    }
    if (responses?.size === 0) this.clients.delete(userId);
  }
}

export const notificationLiveService = new NotificationLiveService();
