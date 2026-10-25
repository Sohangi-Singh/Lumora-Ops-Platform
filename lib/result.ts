import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError, type ErrorCode } from "@/lib/errors";
import { InvalidTransitionError } from "@/lib/workflow/stateMachine";

export type ActionError = {
  code: ErrorCode;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  /** e.g. unmet guard reasons for INVALID_TRANSITION */
  reasons?: string[];
};

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: ActionError };

export function ok<T>(data: T): ActionResult<T>;
export function ok(): ActionResult<void>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(code: ErrorCode, message?: string, extra?: Partial<ActionError>): { ok: false; error: ActionError } {
  return { ok: false, error: { code, message, ...extra } };
}

export function toActionError(err: unknown): ActionError {
  if (err instanceof InvalidTransitionError) {
    return { code: "INVALID_TRANSITION", message: err.message, reasons: err.reasons };
  }
  if (err instanceof AppError) return { code: err.code, message: err.message };
  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { code: "VALIDATION", fieldErrors };
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return { code: "CONFLICT", message: "Duplicate record" };
    if (err.code === "P2025") return { code: "NOT_FOUND" };
    console.error("[db]", err.code, err.message);
    return { code: "DB_ERROR" };
  }
  if (err instanceof Prisma.PrismaClientInitializationError || err instanceof Prisma.PrismaClientUnknownRequestError) {
    console.error("[db]", err.message);
    return { code: "DB_ERROR" };
  }
  console.error("[action] unexpected error", err);
  return { code: "GENERIC" };
}

/** Wrap a server-action body so every failure becomes a typed result. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    // Let Next.js control-flow errors (redirect/notFound) propagate.
    if (err && typeof err === "object" && "digest" in err && typeof err.digest === "string" && err.digest.startsWith("NEXT_")) {
      throw err;
    }
    return { ok: false, error: toActionError(err) };
  }
}
