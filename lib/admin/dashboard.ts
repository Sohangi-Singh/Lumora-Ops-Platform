import "server-only";
import { db } from "@/lib/db";
import { expireStaleQuotes } from "@/lib/quotes/service";
import { getSettings } from "@/lib/settings";
import { computeBlockers, sortBlockersByAge, type Blocker } from "@/lib/workflow/blockers";
import { loadSnapshots } from "@/lib/workflow/service";

const DAY = 86_400_000;

export async function getDashboard() {
  await expireStaleQuotes();
  const [settings, projects, snapshots, quotesPending, paymentsToVerify, settled, accepted] = await Promise.all([
    getSettings(),
    db.project.findMany({
      orderBy: { stageEnteredAt: "asc" },
      select: { id: true, stage: true, stageEnteredAt: true, systemKw: true, completedAt: true, customer: { select: { city: true, user: { select: { name: true } } } } },
    }),
    loadSnapshots({}),
    db.quote.count({ where: { status: "PENDING_APPROVAL" } }),
    db.payment.count({ where: { status: "PENDING_VERIFICATION" } }),
    db.payment.findMany({ where: { status: { in: ["PAID", "VERIFIED"] } }, select: { amount: true, paidAt: true, verifiedAt: true, createdAt: true, projectId: true } }),
    db.quote.findMany({ where: { status: "ACCEPTED" }, select: { projectId: true, totalInclGst: true } }),
  ]);

  const now = new Date();
  const policy = { completionDays: settings.quote.completionDays, slaRiskDaysRemaining: settings.sla.slaRiskDaysRemaining, quoteExpiringWithinDays: 1 };
  const byId = new Map(projects.map((p) => [p.id, p]));
  const blockers: (Blocker & { projectId: string; projectName: string })[] = [];
  for (const s of snapshots) {
    for (const b of computeBlockers(s, now, policy)) blockers.push({ ...b, projectId: s.id, projectName: byId.get(s.id)?.customer.user.name ?? "—" });
  }

  const collected = settled.reduce((sum, p) => sum + p.amount, 0);
  const contracted = accepted.reduce((sum, q) => sum + q.totalInclGst, 0);
  const slaRisk = new Set(blockers.filter((b) => b.code === "SLA_AT_RISK" || b.code === "SLA_BREACHED").map((b) => b.projectId)).size;

  // Last 12 months of collections (IST month buckets).
  const months: { key: string; amount: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push({ key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`, amount: 0 });
  }
  for (const p of settled) {
    const at = new Date((p.verifiedAt ?? p.paidAt ?? p.createdAt).getTime() + 5.5 * 3600_000);
    const key = `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, "0")}`;
    const bucket = months.find((m) => m.key === key);
    if (bucket) bucket.amount += p.amount;
  }

  return {
    kpis: {
      active: projects.filter((p) => !p.completedAt).length,
      quotesPending,
      paymentsToVerify,
      collected,
      pending: Math.max(0, contracted - settled.filter((p) => accepted.some((q) => q.projectId === p.projectId)).reduce((s, p) => s + p.amount, 0)),
      slaRisk,
    },
    projects: projects.map((p) => ({
      id: p.id,
      stage: p.stage,
      name: p.customer.user.name,
      city: p.customer.city,
      kw: p.systemKw,
      complete: Boolean(p.completedAt),
      daysInStage: Math.floor((now.getTime() - p.stageEnteredAt.getTime()) / DAY),
      blockerCount: blockers.filter((b) => b.projectId === p.id).length,
      critical: blockers.some((b) => b.projectId === p.id && b.severity === "critical"),
    })),
    blockers: sortBlockersByAge(blockers),
    revenue: months,
  };
}
