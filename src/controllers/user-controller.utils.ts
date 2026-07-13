import { CreateUserInput } from "../repositories/user.repository.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isUuid = (value: string): boolean => UUID_PATTERN.test(value);

export const parseCreateUserInput = (body: unknown): CreateUserInput | null => {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const { name, email, ltiSubject } = body as Record<string, unknown>;

  if (
    typeof name !== "string" ||
    name.trim() === "" ||
    typeof email !== "string" ||
    email.trim() === "" ||
    !email.includes("@") ||
    (ltiSubject !== undefined &&
      ltiSubject !== null &&
      typeof ltiSubject !== "string")
  ) {
    return null;
  }

  return {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    ltiSubject:
      typeof ltiSubject === "string" ? ltiSubject.trim() || null : null,
  };
};

export const getDatabaseErrorCode = (error: unknown): string | null => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }

  return typeof error.code === "string" ? error.code : null;
};
