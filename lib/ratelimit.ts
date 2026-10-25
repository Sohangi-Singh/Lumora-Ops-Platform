import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";

/**
 * Fixed-window limiter backed by Postgres, so it holds across serverless
 * instances (an in-memory map would reset on every cold start).
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowSeconds * 1000);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart") VALUES (${key}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" < ${cutoff} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" < ${cutoff} THEN ${now} ELSE "RateLimit"."windowStart" END
    RETURNING "count"`;
  if ((rows[0]?.count ?? 0) > limit) throw new AppError("RATE_LIMITED");
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
