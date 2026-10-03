import assert from "node:assert/strict";
import test from "node:test";
import type { Response } from "express";
import { NotificationCategory } from "../entities/enums.js";
import type { Notification } from "../entities/notification.js";
import { NotificationLiveService } from "./notification-live.service.js";

const notification = {
  id: "notification-id",
  recipientId: "user-id",
  title: "Grade available",
  body: "Your grade is ready.",
  category: NotificationCategory.GRADE,
} as Notification;

test("publishes an SSE notification only to the subscribed user", () => {
  const service = new NotificationLiveService();
  const firstWrites: string[] = [];
  const otherWrites: string[] = [];
  const first = { write: (value: string) => firstWrites.push(value) } as unknown as Response;
  const other = { write: (value: string) => otherWrites.push(value) } as unknown as Response;

  service.subscribe("user-id", first);
  service.subscribe("other-user", other);
  service.publish(notification);

  assert.equal(firstWrites.length, 1);
  assert.match(firstWrites[0], /^event: notification\ndata: /);
  assert.match(firstWrites[0], /Grade available/);
  assert.deepEqual(otherWrites, []);
});

test("unsubscribe stops subsequent live delivery", () => {
  const service = new NotificationLiveService();
  const writes: string[] = [];
  const response = { write: (value: string) => writes.push(value) } as unknown as Response;
  const unsubscribe = service.subscribe("user-id", response);

  unsubscribe();
  service.publish(notification);

  assert.deepEqual(writes, []);
});
