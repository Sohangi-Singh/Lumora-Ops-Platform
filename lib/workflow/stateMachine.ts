/**
 * Project lifecycle state machine — pure, no I/O. The DB layer builds a
 * ProjectSnapshot, asks this module whether a move is allowed, and persists.
 *
 * Model: a project sits *in* a stage until that stage's exit condition holds;
 * then it may move to the next stage (strictly linear, no skipping).
 */

export const STAGES = [
  "REGISTERED",
  "DOCUMENTS",
  "SURVEY",
  "QUOTE",
  "ADVANCE_PAYMENT",
  "SUBSIDY_APPLICATION",
  "INSTALLATION",
  "NET_METERING",
  "COMMISSIONED",
  "SUBSIDY_CREDITED",
] as const;
export type Stage = (typeof STAGES)[number];

export type Actor = "CUSTOMER" | "ADMIN" | "WORKER" | "SYSTEM";

export const STAGE_ACTORS: Record<Stage, Actor[]> = {
  REGISTERED: ["CUSTOMER"],
  DOCUMENTS: ["CUSTOMER", "ADMIN"],
  SURVEY: ["ADMIN", "WORKER"],
  QUOTE: ["SYSTEM", "ADMIN", "CUSTOMER"],
  ADVANCE_PAYMENT: ["CUSTOMER", "ADMIN"],
  SUBSIDY_APPLICATION: ["ADMIN"],
  INSTALLATION: ["ADMIN", "WORKER"],
  NET_METERING: ["ADMIN", "CUSTOMER"],
  COMMISSIONED: ["ADMIN"],
  SUBSIDY_CREDITED: ["ADMIN"],
};

export const REQUIRED_DOCUMENTS = ["ELECTRICITY_BILL", "AADHAAR", "PAN", "CANCELLED_CHEQUE"] as const;
export type RequiredDocument = (typeof REQUIRED_DOCUMENTS)[number];

export type DocStatus = "PENDING" | "APPROVED" | "REJECTED";
export type QuoteStatusT = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "SENT" | "ACCEPTED" | "EXPIRED" | "SUPERSEDED";
export type PaymentStatusT = "CREATED" | "PAID" | "FAILED" | "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED";
export type MilestoneT = "ADVANCE" | "BALANCE";

export type ProjectSnapshot = {
  stage: Stage;
  /** Latest uploaded version of each document type */
  documents: { type: string; status: DocStatus; rejectionReason?: string | null; uploadedAt?: Date }[];
  billConfirmed: boolean;
  workerAssigned: boolean;
  survey: {
    status: "SCHEDULED" | "IN_PROGRESS" | "SUBMITTED";
    scheduledAt: Date;
    hasGeoPhoto: boolean;
  } | null;
  /** The current (non-superseded) quote, if any */
  quote: { status: QuoteStatusT; validTill: Date; acceptedAt: Date | null; createdAt: Date } | null;
  payments: { milestone: MilestoneT; status: PaymentStatusT; createdAt?: Date }[];
  subsidyApplicationNo: string | null;
  materialDispatchedAt: Date | null;
  installedAt: Date | null;
  installationPhotoCount: number;
  netMeteringFiledAt: Date | null;
  netMeterInstalledAt: Date | null;
  subsidyCreditedAt: Date | null;
  createdAt?: Date;
  stageEnteredAt?: Date;
  /** When the advance was received — starts the completion SLA clock */
  advanceReceivedAt?: Date | null;
};

export type GuardReason =
  | `DOC_MISSING:${RequiredDocument}`
  | `DOC_REJECTED:${RequiredDocument}`
  | `DOC_PENDING:${RequiredDocument}`
  | "BILL_NOT_CONFIRMED"
  | "WORKER_NOT_ASSIGNED"
  | "SURVEY_NOT_SUBMITTED"
  | "GEO_PHOTO_MISSING"
  | "QUOTE_MISSING"
  | "QUOTE_NOT_ACCEPTED"
  | "QUOTE_ACCEPTED_AFTER_EXPIRY"
  | "ADVANCE_NOT_PAID"
  | "SUBSIDY_APPLICATION_MISSING"
  | "MATERIAL_NOT_DISPATCHED"
  | "NOT_INSTALLED"
  | "INSTALLATION_PHOTOS_MISSING"
  | "NET_METERING_NOT_FILED"
  | "BALANCE_NOT_PAID"
  | "NET_METER_NOT_INSTALLED"
  | "SUBSIDY_NOT_CREDITED"
  | "NOT_NEXT_STAGE"
  | "ALREADY_FINAL";

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: Stage,
    readonly to: Stage,
    readonly reasons: GuardReason[],
  ) {
    super(`Cannot move project from ${from} to ${to}: ${reasons.join(", ")}`);
    this.name = "InvalidTransitionError";
  }
}

export function stageIndex(stage: Stage): number {
  return STAGES.indexOf(stage);
}

export function nextStage(stage: Stage): Stage | null {
  const i = stageIndex(stage);
  return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1] : null;
}

export function isPaid(status: PaymentStatusT): boolean {
  return status === "PAID" || status === "VERIFIED";
}

export function milestonePaid(s: ProjectSnapshot, milestone: MilestoneT): boolean {
  return s.payments.some((p) => p.milestone === milestone && isPaid(p.status));
}

export function latestDoc(s: ProjectSnapshot, type: string) {
  return s.documents.find((d) => d.type === type);
}

/** Unmet exit conditions for the given stage (empty = stage complete). */
export function exitBlockers(stage: Stage, s: ProjectSnapshot): GuardReason[] {
  const reasons: GuardReason[] = [];
  switch (stage) {
    case "REGISTERED":
      break;
    case "DOCUMENTS":
      for (const type of REQUIRED_DOCUMENTS) {
        const doc = latestDoc(s, type);
        if (!doc) reasons.push(`DOC_MISSING:${type}`);
        else if (doc.status === "REJECTED") reasons.push(`DOC_REJECTED:${type}`);
        else if (doc.status === "PENDING") reasons.push(`DOC_PENDING:${type}`);
      }
      if (!s.billConfirmed) reasons.push("BILL_NOT_CONFIRMED");
      break;
    case "SURVEY":
      if (!s.workerAssigned || !s.survey) reasons.push("WORKER_NOT_ASSIGNED");
      if (!s.survey || s.survey.status !== "SUBMITTED") reasons.push("SURVEY_NOT_SUBMITTED");
      if (!s.survey?.hasGeoPhoto) reasons.push("GEO_PHOTO_MISSING");
      break;
    case "QUOTE":
      if (!s.quote) reasons.push("QUOTE_MISSING");
      else if (s.quote.status !== "ACCEPTED" || !s.quote.acceptedAt) reasons.push("QUOTE_NOT_ACCEPTED");
      else if (s.quote.acceptedAt.getTime() > s.quote.validTill.getTime()) reasons.push("QUOTE_ACCEPTED_AFTER_EXPIRY");
      break;
    case "ADVANCE_PAYMENT":
      if (!milestonePaid(s, "ADVANCE")) reasons.push("ADVANCE_NOT_PAID");
      break;
    case "SUBSIDY_APPLICATION":
      if (!s.subsidyApplicationNo?.trim()) reasons.push("SUBSIDY_APPLICATION_MISSING");
      break;
    case "INSTALLATION":
      if (!s.materialDispatchedAt) reasons.push("MATERIAL_NOT_DISPATCHED");
      if (!s.installedAt) reasons.push("NOT_INSTALLED");
      if (s.installationPhotoCount < 1) reasons.push("INSTALLATION_PHOTOS_MISSING");
      break;
    case "NET_METERING":
      if (!s.netMeteringFiledAt) reasons.push("NET_METERING_NOT_FILED");
      if (!milestonePaid(s, "BALANCE")) reasons.push("BALANCE_NOT_PAID");
      break;
    case "COMMISSIONED":
      if (!s.netMeterInstalledAt) reasons.push("NET_METER_NOT_INSTALLED");
      break;
    case "SUBSIDY_CREDITED":
      if (!s.subsidyCreditedAt) reasons.push("SUBSIDY_NOT_CREDITED");
      break;
  }
  return reasons;
}

export type TransitionCheck = { ok: true } | { ok: false; reasons: GuardReason[] };

export function canTransition(s: ProjectSnapshot, to: Stage): TransitionCheck {
  const next = nextStage(s.stage);
  if (next === null) return { ok: false, reasons: ["ALREADY_FINAL"] };
  if (to !== next) return { ok: false, reasons: ["NOT_NEXT_STAGE"] };
  const reasons = exitBlockers(s.stage, s);
  return reasons.length ? { ok: false, reasons } : { ok: true };
}

export function assertTransition(s: ProjectSnapshot, to: Stage): void {
  const check = canTransition(s, to);
  if (!check.ok) throw new InvalidTransitionError(s.stage, to, check.reasons);
}

/**
 * Stages the project can move through right now, in order. The workflow
 * service calls this after every relevant change so the tracker advances
 * automatically (e.g. last document approved → SURVEY).
 */
export function autoAdvancePath(s: ProjectSnapshot): Stage[] {
  const path: Stage[] = [];
  let current: ProjectSnapshot = s;
  for (;;) {
    const next = nextStage(current.stage);
    if (!next || !canTransition(current, next).ok) break;
    path.push(next);
    current = { ...current, stage: next };
  }
  return path;
}

/** Final stage reached and its own exit condition met. */
export function isProjectComplete(s: ProjectSnapshot): boolean {
  return s.stage === "SUBSIDY_CREDITED" && exitBlockers("SUBSIDY_CREDITED", s).length === 0;
}
