import "server-only";
import type { Prisma, Stage } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeIndianMobile } from "@/lib/format";
import { blockersFor, loadSnapshot, loadSnapshots } from "@/lib/workflow/service";
import { computeBlockers } from "@/lib/workflow/blockers";
import { getSettings } from "@/lib/settings";

export function projectSearchWhere(q: string | undefined, stage: string | undefined): Prisma.ProjectWhereInput {
  const where: Prisma.ProjectWhereInput = {};
  if (stage) where.stage = stage as Stage;
  const term = q?.trim();
  if (term) {
    const digits = normalizeIndianMobile(term);
    where.OR = [
      { customer: { user: { name: { contains: term, mode: "insensitive" } } } },
      { customer: { user: { email: { contains: term, mode: "insensitive" } } } },
      ...(digits.length >= 4 ? [{ customer: { user: { phone: { contains: digits } } } }] : []),
      { billData: { serviceNo: { contains: term } } },
      { quotes: { some: { refNo: { contains: term } } } },
    ];
  }
  return where;
}

export async function listProjects(q?: string, stage?: string) {
  const where = projectSearchWhere(q, stage);
  const [rows, snapshots, settings] = await Promise.all([
    db.project.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: {
        customer: { include: { user: { select: { name: true, phone: true, email: true } } } },
        assignedWorker: { select: { name: true } },
      },
    }),
    loadSnapshots(where),
    getSettings(),
  ]);
  const now = new Date();
  const blockersById = new Map(
    snapshots.map((s) => [
      s.id,
      computeBlockers(s, now, { completionDays: settings.quote.completionDays, slaRiskDaysRemaining: settings.sla.slaRiskDaysRemaining, quoteExpiringWithinDays: 1 }),
    ]),
  );
  return rows.map((r) => ({ ...r, blockers: blockersById.get(r.id) ?? [] }));
}

export async function getProject360(id: string) {
  const project = await db.project.findUnique({
    where: { id },
    include: {
      customer: { include: { user: { select: { id: true, name: true, phone: true, email: true, language: true } } } },
      assignedWorker: { select: { id: true, name: true, phone: true } },
      survey: { include: { worker: { select: { name: true } } } },
      billData: true,
    },
  });
  if (!project) return null;
  const snapshot = await loadSnapshot(db, id);
  const blockers = await blockersFor(snapshot);
  return { project, snapshot, blockers };
}
export type Project360 = NonNullable<Awaited<ReturnType<typeof getProject360>>>;
