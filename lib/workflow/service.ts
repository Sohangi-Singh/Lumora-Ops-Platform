import "server-only";
import type { Prisma } from "@prisma/client";
import { db, type Tx } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { ADMIN_TOPIC, projectTopic, userTopic } from "@/lib/realtime/topics";
import { computeBlockers, type Blocker } from "./blockers";
import { Effects } from "./effects";
import { renderEvent, STAGE_NOTIFICATION, type EventSpec } from "./events";
import { SNAPSHOT_INCLUDE, toSnapshot } from "./snapshot";
import { autoAdvancePath, assertTransition, type ProjectSnapshot, type Stage } from "./stateMachine";

export { toSnapshot } from "./snapshot";

/**
 * The only place that changes a project's stage. Every change runs in one
 * transaction: stage + timestamps + ProjectEvent + notifications, followed
 * (after commit) by realtime pushes and emails.
 */

export async function withWorkflow<T>(fn: (tx: Tx, fx: Effects) => Promise<T>): Promise<T> {
  const fx = new Effects();
  const result = await db.$transaction((tx) => fn(tx, fx), { timeout: 20_000, maxWait: 10_000 });
  await fx.flush();
  return result;
}

export async function loadSnapshot(tx: Tx | typeof db, projectId: string): Promise<ProjectSnapshot> {
  const p = await tx.project.findUniqueOrThrow({ where: { id: projectId }, include: SNAPSHOT_INCLUDE });
  return toSnapshot(p);
}

export async function loadSnapshots(where: Prisma.ProjectWhereInput): Promise<(ProjectSnapshot & { id: string })[]> {
  const rows = await db.project.findMany({ where, include: SNAPSHOT_INCLUDE });
  return rows.map((r) => ({ ...toSnapshot(r), id: r.id }));
}

export async function blockersFor(snapshot: ProjectSnapshot): Promise<Blocker[]> {
  const settings = await getSettings();
  return computeBlockers(snapshot, new Date(), {
    completionDays: settings.quote.completionDays,
    slaRiskDaysRemaining: settings.sla.slaRiskDaysRemaining,
    quoteExpiringWithinDays: 1,
  });
}

export async function recordEvent(
  tx: Tx,
  fx: Effects,
  projectId: string,
  actorId: string | null,
  spec: EventSpec,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const { en, hi, internal } = renderEvent(spec);
  await tx.projectEvent.create({
    data: {
      projectId,
      actorId,
      type: spec.type,
      payload: { ...spec, ...payload } as Prisma.InputJsonValue,
      messageEn: en,
      messageHi: hi,
      internal,
    },
  });
  fx.broadcast(projectTopic(projectId), ADMIN_TOPIC);
}

export type NotificationText = { titleEn: string; titleHi: string; bodyEn: string; bodyHi: string; href?: string };

export async function notifyUsers(tx: Tx, fx: Effects, userIds: string[], projectId: string | null, n: NotificationText) {
  const ids = [...new Set(userIds)];
  if (!ids.length) return;
  await tx.notification.createMany({
    data: ids.map((userId) => ({ userId, projectId, ...n, href: n.href ?? null })),
  });
  const users = await tx.user.findMany({ where: { id: { in: ids }, isActive: true }, select: { id: true, email: true, language: true } });
  for (const u of users) {
    fx.broadcast(userTopic(u.id));
    const hi = u.language === "hi";
    fx.email({
      to: u.email,
      subject: `${hi ? n.titleHi : n.titleEn} · Lumora Solar`,
      heading: hi ? n.titleHi : n.titleEn,
      body: hi ? n.bodyHi : n.bodyEn,
      ctaHref: n.href,
      ctaLabel: hi ? "लूमोरा सोलर खोलें" : "Open Lumora Solar",
    });
  }
}

export async function notifyCustomer(tx: Tx, fx: Effects, projectId: string, n: NotificationText) {
  const p = await tx.project.findUniqueOrThrow({ where: { id: projectId }, select: { customer: { select: { userId: true } } } });
  await notifyUsers(tx, fx, [p.customer.userId], projectId, n);
}

export async function notifyAdmins(tx: Tx, fx: Effects, projectId: string | null, n: NotificationText) {
  const admins = await tx.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
  await notifyUsers(
    tx,
    fx,
    admins.map((a) => a.id),
    projectId,
    n,
  );
}

async function enterStage(tx: Tx, fx: Effects, projectId: string, from: Stage, to: Stage, actorId: string | null) {
  const now = new Date();
  const current = await tx.project.findUniqueOrThrow({ where: { id: projectId }, select: { stageTimestamps: true } });
  const stamps = { ...((current.stageTimestamps as Record<string, string>) ?? {}), [to]: now.toISOString() };
  await tx.project.update({
    where: { id: projectId },
    data: { stage: to, stageEnteredAt: now, stageTimestamps: stamps },
  });
  await recordEvent(tx, fx, projectId, actorId, { type: "STAGE_CHANGED", from, to });
  const n = STAGE_NOTIFICATION[to];
  if (n) await notifyCustomer(tx, fx, projectId, n);
  if (to === "QUOTE") {
    // Auto-quote: documents approved + bill confirmed + survey submitted → draft quote for admin approval.
    fx.later(async () => (await import("@/lib/quotes/service")).autoGenerateQuote(projectId));
  }
}

/**
 * Move the project forward through every stage whose exit condition now
 * holds. Call after any change that could satisfy a guard. Idempotent.
 */
export async function advanceIfReady(tx: Tx, fx: Effects, projectId: string, actorId: string | null): Promise<Stage[]> {
  // Serialise concurrent advances of the same project (row lock).
  await tx.$executeRaw`SELECT id FROM "Project" WHERE id = ${projectId} FOR UPDATE`;
  const snapshot = await loadSnapshot(tx, projectId);
  const path = autoAdvancePath(snapshot);
  let from = snapshot.stage;
  for (const to of path) {
    assertTransition({ ...snapshot, stage: from }, to);
    await enterStage(tx, fx, projectId, from, to, actorId);
    if (to === "SUBSIDY_APPLICATION" && snapshot.advanceReceivedAt) {
      const settings = await getSettings();
      await tx.project.update({
        where: { id: projectId },
        data: { targetCompletionDate: new Date(snapshot.advanceReceivedAt.getTime() + settings.quote.completionDays * 86_400_000) },
      });
    }
    from = to;
  }
  return path;
}
