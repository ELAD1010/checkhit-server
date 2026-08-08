import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { LocalFileStorage } from "./local-file-storage.js";

test("LocalFileStorage writes checksummed files and blocks traversal", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "checkhit-storage-"));
  const storage = new LocalFileStorage(root);

  try {
    const stored = await storage.store({
      buffer: Buffer.from("student answer"),
      originalName: "../answer.txt",
      mimeType: "text/plain",
      prefix: "submissions",
    });

    assert.equal(stored.originalName, "answer.txt");
    assert.equal(
      stored.checksum,
      "eef02932aab7856b486361c0880caf9db4cd6bef847e7669448ac5ceaf277935",
    );
    assert.equal(
      (await readFile(storage.resolvePath(stored.objectKey))).toString(),
      "student answer",
    );
    assert.throws(() => storage.resolvePath("../outside.txt"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
