import multer from "multer";
import type { ErrorRequestHandler } from "express";
import { getGradingConfig } from "../config/grading.config.js";
import {
  detectMimeType,
  isAllowedUploadMimeType,
} from "../storage/upload-mime.js";

const config = getGradingConfig();

export type UploadedFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

export const uploadSingleDocument = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxUploadBytes,
    files: 5,
  },
  fileFilter: (_req, file, callback) => {
    const mimeType = detectMimeType(file.originalname);
    if (!mimeType || !isAllowedUploadMimeType(mimeType)) {
      callback(
        new Error("Only PDF, DOCX, and plain text uploads are supported"),
      );
      return;
    }

    file.mimetype = mimeType;
    callback(null, true);
  },
});

export const handleUploadErrors: ErrorRequestHandler = (
  error,
  _req,
  res,
  next,
) => {
  if (error instanceof multer.MulterError) {
    res.status(400).json({ message: error.message, code: error.code });
    return;
  }

  if (
    error instanceof Error &&
    error.message === "Only PDF, DOCX, and plain text uploads are supported"
  ) {
    res.status(400).json({ message: error.message });
    return;
  }

  next(error);
};
