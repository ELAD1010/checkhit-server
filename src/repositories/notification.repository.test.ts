import assert from "node:assert/strict";
import test from "node:test";
import { NotificationCategory } from "../entities/enums.js";
import { Notification } from "../entities/notification.js";
import { User } from "../entities/user.js";
import { NotificationRepository } from "./notification.repository.js";

test("notification event keys are idempotent per recipient", async () => {
  const saved: Notification[] = [];
  const notificationRepo = {
    async findOne({ where }: { where: { recipientId: string; eventKey: string } }) {
      return saved.find(
        (item) =>
          item.recipientId === where.recipientId && item.eventKey === where.eventKey,
      ) ?? null;
    },
    create(data: Partial<Notification>) {
      return Object.assign(new Notification(), data, { id: "notification-1" });
    },
    async save(notification: Notification) {
      saved.push(notification);
      return notification;
    },
  };
  const userRepo = { async findOne() { return { id: "user-1" }; } };
  const dataSource = {
    getRepository(entity: typeof Notification | typeof User) {
      return entity === Notification ? notificationRepo : userRepo;
    },
  };
  const repository = new NotificationRepository(dataSource as never);
  const input = {
    recipientId: "user-1",
    title: "Grade available",
    body: "Your grade is ready.",
    category: NotificationCategory.GRADE,
    eventKey: "GRADE_READY:evaluation-1",
  };

  const first = await repository.createNotificationIfAbsent(input);
  const second = await repository.createNotificationIfAbsent(input);

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(first.notification.id, second.notification.id);
  assert.equal(saved.length, 1);
});
