import type { Prisma } from "@prisma/client";
import type { ProjectSnapshot } from "./stateMachine";

/** DB → pure ProjectSnapshot mapping (no server-only deps, so scripts can use it too). */
export const SNAPSHOT_INCLUDE = {
  documents: {
    where: { isLatest: true, uploaded: true },
    select: { type: true, status: true, rejectionReason: true, createdAt: true },
  },
  billData: { select: { confirmedByAdmin: true } },
  survey: {
    select: {
      status: true,
      scheduledAt: true,
      photos: { where: { kind: "SURVEY_ROOF", uploaded: true, lat: { not: null } }, select: { id: true }, take: 1 },
    },
  },
  quotes: {
    where: { status: { not: "SUPERSEDED" } },
    orderBy: { version: "desc" },
    take: 1,
    select: { status: true, validTill: true, acceptedAt: true, createdAt: true },
  },
  payments: { select: { milestone: true, status: true, createdAt: true, paidAt: true, verifiedAt: true } },
  _count: { select: { photos: { where: { kind: { in: ["INSTALL_BEFORE", "INSTALL_AFTER"] }, uploaded: true } } } },
} satisfies Prisma.ProjectInclude;

type SnapshotRow = Prisma.ProjectGetPayload<{ include: typeof SNAPSHOT_INCLUDE }>;

export function toSnapshot(p: SnapshotRow): ProjectSnapshot {
  const advance = p.payments
    .filter((x) => x.milestone === "ADVANCE" && (x.status === "PAID" || x.status === "VERIFIED"))
    .map((x) => x.verifiedAt ?? x.paidAt ?? x.createdAt)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  return {
    stage: p.stage,
    documents: p.documents.map((d) => ({ type: d.type, status: d.status, rejectionReason: d.rejectionReason, uploadedAt: d.createdAt })),
    billConfirmed: Boolean(p.billData?.confirmedByAdmin),
    workerAssigned: Boolean(p.assignedWorkerId),
    survey: p.survey ? { status: p.survey.status, scheduledAt: p.survey.scheduledAt, hasGeoPhoto: p.survey.photos.length > 0 } : null,
    quote: p.quotes[0] ?? null,
    payments: p.payments.map((x) => ({ milestone: x.milestone, status: x.status, createdAt: x.createdAt })),
    subsidyApplicationNo: p.subsidyApplicationNo,
    materialDispatchedAt: p.materialDispatchedAt,
    installedAt: p.installedAt,
    installationPhotoCount: p._count.photos,
    netMeteringFiledAt: p.netMeteringFiledAt,
    netMeterInstalledAt: p.netMeterInstalledAt,
    subsidyCreditedAt: p.subsidyCreditedAt,
    createdAt: p.createdAt,
    stageEnteredAt: p.stageEnteredAt,
    advanceReceivedAt: advance ?? null,
  };
}

