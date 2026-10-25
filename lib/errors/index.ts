/**
 * Typed domain errors. Server actions convert these into ActionResult errors
 * (see lib/result.ts); anything else is logged and shown as a generic error.
 */
export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "RATE_LIMITED"
  | "INVALID_TRANSITION"
  | "CONFLICT"
  | "QUOTE_EXPIRED"
  | "ALREADY_PAID"
  | "PAYMENT_FAILED"
  | "FILE_TOO_LARGE"
  | "FILE_TYPE"
  | "FILE_CONTENT_MISMATCH"
  | "UPLOAD_FAILED"
  | "NOT_CONFIGURED"
  | "DB_ERROR"
  | "GENERIC";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, message?: string, details?: unknown) {
    super(message ?? code);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }
}

export class AuthzError extends AppError {
  constructor(code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND", message?: string) {
    super(code, message);
    this.name = "AuthzError";
  }
}
