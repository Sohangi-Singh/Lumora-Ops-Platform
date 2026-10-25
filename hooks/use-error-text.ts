"use client";

import { useTranslations } from "next-intl";
import type { ActionError } from "@/lib/result";

const CODE_TO_KEY = {
  UNAUTHENTICATED: "unauthorized",
  FORBIDDEN: "forbiddenTitle",
  NOT_FOUND: "notFoundTitle",
  RATE_LIMITED: "rateLimited",
  VALIDATION: "validation",
  INVALID_TRANSITION: "invalidTransition",
  FILE_TOO_LARGE: "fileTooLarge",
  FILE_TYPE: "fileType",
  FILE_CONTENT_MISMATCH: "fileContentMismatch",
  UPLOAD_FAILED: "uploadFailed",
  DB_ERROR: "dbError",
} as const;

/** Turns a typed ActionError into a localized, human sentence. */
export function useErrorText() {
  const t = useTranslations("errors");
  const ta = useTranslations("auth");
  return (error: ActionError | undefined | null): string => {
    if (!error) return "";
    const authKey = error.message as Parameters<typeof ta>[0];
    if (error.message && ta.has(authKey)) return ta(authKey);
    const key = CODE_TO_KEY[error.code as keyof typeof CODE_TO_KEY];
    if (key) return t(key);
    // Domain errors carry a readable English message (admin-facing).
    if (error.message && error.code !== "GENERIC" && error.code !== "DB_ERROR") return error.message;
    return t("generic");
  };
}
