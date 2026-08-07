import mammoth from "mammoth";
import { DOCX_MIME, PDF_MIME, TEXT_MIME } from "./upload-mime.js";

export type ExtractedDocumentContent = {
  text: string;
  pdfBuffer: Buffer | null;
  mimeType: string;
};

export const extractDocumentContent = async (input: {
  buffer: Buffer;
  mimeType: string;
}): Promise<ExtractedDocumentContent> => {
  if (input.mimeType === PDF_MIME) {
    return {
      text: "",
      pdfBuffer: input.buffer,
      mimeType: input.mimeType,
    };
  }

  if (input.mimeType === DOCX_MIME) {
    const result = await mammoth.extractRawText({ buffer: input.buffer });
    return {
      text: result.value.trim(),
      pdfBuffer: null,
      mimeType: input.mimeType,
    };
  }

  if (input.mimeType === TEXT_MIME) {
    return {
      text: input.buffer.toString("utf8").trim(),
      pdfBuffer: null,
      mimeType: input.mimeType,
    };
  }

  throw new Error(`Unsupported document MIME type: ${input.mimeType}`);
};
