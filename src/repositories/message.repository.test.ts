import assert from "node:assert/strict";
import test from "node:test";
import { MessageTargetType } from "../entities/enums.js";
import { threadReplyRecipientIds } from "./message.repository.js";

const direct = {
  senderId: "lecturer",
  targetType: MessageTargetType.DIRECT,
  recipients: [{ recipientId: "student-a" }],
};

const broadcast = {
  senderId: "lecturer",
  targetType: MessageTargetType.BROADCAST,
  recipients: [
    { recipientId: "student-a" },
    { recipientId: "student-b" },
    { recipientId: "lecturer" },
  ],
};

test("a direct reply resurfaces the thread for the other participant only", () => {
  assert.deepEqual(threadReplyRecipientIds(direct, "student-a"), ["lecturer"]);
  assert.deepEqual(threadReplyRecipientIds(direct, "lecturer"), ["student-a"]);
});

test("student replies to a broadcast reach only its author", () => {
  assert.deepEqual(threadReplyRecipientIds(broadcast, "student-b"), ["lecturer"]);
});

test("the author's broadcast reply reaches every recipient once", () => {
  assert.deepEqual(threadReplyRecipientIds(broadcast, "lecturer"), [
    "student-a",
    "student-b",
  ]);
});
