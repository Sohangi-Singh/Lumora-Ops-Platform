"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertCanAccessProject, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { approveQuote, expireStaleQuotes, generateQuote } from "@/lib/quotes/service";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { runAction } from "@/lib/result";
import { isQuoteExpired } from "@/lib/solar/quote";
import { advanceIfReady, notifyAdmins, recordEvent, withWorkflow } from "@/lib/workflow/service";

const OverridesSchema = z
  .object({
    projectId: z.string().min(1),
    systemKw: z.number().positive().max(100).nullable(),
    phase: z.enum(["SINGLE", "THREE"]).nullable(),
    panelCount: z.number().int().positive().max(500).nullable(),
    reason: z.string().trim().max(300).nullable(),
  })
  .refine((o) => (!o.systemKw && !o.panelCount && !o.phase) || (o.reason && o.reason.length >= 3), {
    message: "A reason is required when overriding the recommendation",
    path: ["reason"],
  });

/** Admin regenerates the quote, optionally overriding kW / phase / panels (reason logged). */
export async function regenerateQuoteAction(input: z.input<typeof OverridesSchema>) {
  return runAction(async () => {
    const admin = await requireRole("ADMIN");
    const data = OverridesSchema.parse(input);
    const id = await generateQuote(data.projectId, {
      actorId: admin.id,
      overrides: { systemKw: data.systemKw, phase: data.phase, panelCount: data.panelCount, reason: data.reason },
    });
    revalidatePath(`/admin/projects/${data.projectId}`);
    return { quoteId: id };
  });
}

export async function approveQuoteAction(quoteId: string) {
  return runAction(async () => {
    const admin = await requireRole("ADMIN");
    await approveQuote(z.string().min(1).parse(quoteId), admin.id);
    revalidatePath("/admin", "layout");
  });
}

/** Customer accepts: stores timestamp, IP and user agent; must be within validity. */
export async function acceptQuoteAction(quoteId: string) {
  return runAction(async () => {
    const user = await requireRole("CUSTOMER");
    const quote = await db.quote.findUnique({ where: { id: z.string().min(1).parse(quoteId) }, include: { project: { select: { stage: true } } } });
    if (!quote) throw new AppError("NOT_FOUND");
    await assertCanAccessProject(user, quote.projectId);
    await rateLimit(`accept:${user.id}`, 10, 60);
    if (quote.status === "ACCEPTED") return;
    const now = new Date();
    if (isQuoteExpired(quote.validTill, now)) {
      await expireStaleQuotes(quote.projectId);
      throw new AppError("QUOTE_EXPIRED");
    }
    if (quote.status !== "SENT" && quote.status !== "APPROVED") throw new AppError("CONFLICT", "This quotation can no longer be accepted");
    if (quote.project.stage !== "QUOTE") throw new AppError("INVALID_TRANSITION");

    const h = await headers();
    const ip = await clientIp();
    await withWorkflow(async (tx, fx) => {
      const r = await tx.quote.updateMany({
        where: { id: quote.id, status: { in: ["SENT", "APPROVED"] } },
        data: { status: "ACCEPTED", acceptedAt: now, acceptedIp: ip, acceptedUserAgent: h.get("user-agent")?.slice(0, 300) ?? null },
      });
      if (r.count !== 1) throw new AppError("CONFLICT");
      await recordEvent(tx, fx, quote.projectId, user.id, { type: "QUOTE_ACCEPTED", refNo: quote.refNo }, { ip });
      await notifyAdmins(tx, fx, quote.projectId, {
        titleEn: `Quote ${quote.refNo} accepted`,
        titleHi: `कोटेशन ${quote.refNo} स्वीकार हुआ`,
        bodyEn: `${user.name} accepted the ${quote.systemKw} kW proposal. Advance payment is next.`,
        bodyHi: `${user.name} ने ${quote.systemKw} किलोवाट का प्रस्ताव स्वीकार किया।`,
        href: `/admin/projects/${quote.projectId}?tab=quote`,
      });
      await advanceIfReady(tx, fx, quote.projectId, user.id);
    });
    revalidatePath("/portal", "layout");
  });
}

/** Expired quote → customer asks for a revised one. */
export async function requestRevisionAction() {
  return runAction(async () => {
    const user = await requireRole("CUSTOMER");
    const project = await db.project.findFirst({ where: { customer: { userId: user.id } }, select: { id: true } });
    if (!project) throw new AppError("NOT_FOUND");
    await rateLimit(`revision:${user.id}`, 3, 3600);
    await withWorkflow(async (tx, fx) => {
      await recordEvent(tx, fx, project.id, user.id, { type: "QUOTE_REVISION_REQUESTED" });
      await notifyAdmins(tx, fx, project.id, {
        titleEn: "Revised quote requested",
        titleHi: "नया कोटेशन माँगा गया",
        bodyEn: `${user.name}'s quotation expired and they asked for a revised one.`,
        bodyHi: `${user.name} का कोटेशन खत्म हो गया, उन्होंने नया कोटेशन माँगा है।`,
        href: `/admin/projects/${project.id}?tab=quote`,
      });
    });
  });
}
