import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rename, rm, unlink } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { getGradingConfig } from "../config/grading.config.js";

export type StoredFile = {
  objectKey: string;
  absolutePath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
};

export type StoreFileInput = {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  prefix?: string;
};

export interface FileStorage {
  store(input: StoreFileInput): Promise<StoredFile>;
  resolvePath(objectKey: string): string;
  read(objectKey: string): Promise<Buffer>;
  delete(objectKey: string): Promise<void>;
}

const sanitizeFileName = (originalName: string): string => {
  const baseName = path.basename(originalName).replace(/[^\w.\-()+ ]+/g, "_");
  return baseName.slice(0, 180) || "upload.bin";
};

const assertSafeObjectKey = (objectKey: string): void => {
  if (
    !objectKey ||
    objectKey.includes("\0") ||
    objectKey.includes("..") ||
    path.isAbsolute(objectKey)
  ) {
    throw new Error("Invalid object key");
  }
};

export class LocalFileStorage implements FileStorage {
  constructor(
    private readonly rootDirectory: string = getGradingConfig().storageRoot,
  ) {}

  async store(input: StoreFileInput): Promise<StoredFile> {
    await mkdir(this.rootDirectory, { recursive: true });

    const prefix = (input.prefix ?? "uploads").replace(/[\\/]+/g, "-");
    const objectKey = path.posix.join(
      prefix,
      `${new Date().toISOString().slice(0, 10)}`,
      `${randomUUID()}-${sanitizeFileName(input.originalName)}`,
    );
    const absolutePath = this.resolvePath(objectKey);
    await mkdir(path.dirname(absolutePath), { recursive: true });

    const temporaryPath = `${absolutePath}.tmp`;
    const checksum = createHash("sha256").update(input.buffer).digest("hex");

    try {
      await pipeline(
        Readable.from(input.buffer),
        createWriteStream(temporaryPath),
      );
      await rename(temporaryPath, absolutePath);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }

    return {
      objectKey,
      absolutePath,
      originalName: sanitizeFileName(input.originalName),
      mimeType: input.mimeType,
      sizeBytes: input.buffer.byteLength,
      checksum,
    };
  }

  resolvePath(objectKey: string): string {
    assertSafeObjectKey(objectKey);
    const absolutePath = path.resolve(this.rootDirectory, objectKey);
    const root = path.resolve(this.rootDirectory);

    if (
      absolutePath !== root &&
      !absolutePath.startsWith(`${root}${path.sep}`)
    ) {
      throw new Error("Object key escapes storage root");
    }

    return absolutePath;
  }

  async read(objectKey: string): Promise<Buffer> {
    const { readFile } = await import("node:fs/promises");
    return readFile(this.resolvePath(objectKey));
  }

  async delete(objectKey: string): Promise<void> {
    await rm(this.resolvePath(objectKey), { force: true });
  }
}
