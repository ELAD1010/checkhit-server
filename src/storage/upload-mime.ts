export const PDF_MIME = "application/pdf";
export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const TEXT_MIME = "text/plain";

export const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  PDF_MIME,
  DOCX_MIME,
  TEXT_MIME,
]);

export const detectMimeType = (originalName: string): string | null => {
  const extension = originalName.split(".").pop()?.toLowerCase();

  if (extension === "pdf") {
    return PDF_MIME;
  }

  if (extension === "docx") {
    return DOCX_MIME;
  }

  if (extension === "txt") {
    return TEXT_MIME;
  }

  return null;
};

export const isAllowedUploadMimeType = (mimeType: string): boolean =>
  ALLOWED_UPLOAD_MIME_TYPES.has(mimeType);

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

export const assertFileContentMatchesMime = (
  buffer: Buffer,
  mimeType: string,
): void => {
  if (buffer.length === 0) {
    throw new UploadValidationError("Uploaded file is empty");
  }

  if (
    mimeType === PDF_MIME &&
    buffer.subarray(0, 5).toString("ascii") !== "%PDF-"
  ) {
    throw new UploadValidationError(
      "Uploaded file does not contain a valid PDF signature",
    );
  }

  if (
    mimeType === DOCX_MIME &&
    !(
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      [0x03, 0x05, 0x07].includes(buffer[2] ?? -1) &&
      [0x04, 0x06, 0x08].includes(buffer[3] ?? -1)
    )
  ) {
    throw new UploadValidationError(
      "Uploaded file does not contain a valid DOCX/ZIP signature",
    );
  }

  if (mimeType === TEXT_MIME && buffer.includes(0)) {
    throw new UploadValidationError(
      "Plain text uploads cannot contain null bytes",
    );
  }
};
