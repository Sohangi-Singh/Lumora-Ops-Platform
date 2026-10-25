import { latestDoc, milestonePaid, REQUIRED_DOCUMENTS, stageIndex, type ProjectSnapshot } from "./stateMachine";

/**
 * What is missing for a project right now, and who owes it. Powers the
 * customer's "Action needed from you" card and the admin blockers panel.
 * Pure: (snapshot, now, policy) → blockers. Messages are i18n keys
 * `blockers.<code>` interpolated with `params`.
 */

export type BlockerOwner = "CUSTOMER" | "WORKER" | "ADMIN";
export type BlockerSeverity = "info" | "warning" | "critical";

export type BlockerCode =
  | "DOC_MISSING"
  | "DOC_REJECTED"
  | "DOC_REVIEW"
  | "BILL_DATA_UNCONFIRMED"
  | "SURVEY_UNASSIGNED"
  | "SURVEY_SCHEDULED"
  | "SURVEY_OVERDUE"
  | "GEO_PHOTO_MISSING"
  | "QUOTE_NOT_GENERATED"
  | "QUOTE_AWAITING_APPROVAL"
  | "QUOTE_AWAITING_ACCEPTANCE"
  | "QUOTE_EXPIRING"
  | "QUOTE_EXPIRED"
  | "ADVANCE_PENDING"
  | "PAYMENT_TO_VERIFY"
  | "SUBSIDY_APPLICATION_PENDING"
  | "MATERIAL_DISPATCH_PENDING"
  | "INSTALLATION_PENDING"
  | "INSTALL_PHOTOS_MISSING"
  | "NET_METERING_FILE_PENDING"
  | "BALANCE_PENDING"
  | "NET_METER_INSTALL_PENDING"
  | "SUBSIDY_CREDIT_PENDING"
  | "SLA_AT_RISK"
  | "SLA_BREACHED";

export type Blocker = {
  code: BlockerCode;
  owner: BlockerOwner;
  severity: BlockerSeverity;
  params: Record<string, string | number>;
  /** When this started being a blocker (for "sorted by age") */
  since?: Date;
};

export type BlockerPolicy = {
  completionDays: number;
  slaRiskDaysRemaining: number;
  quoteExpiringWithinDays: number;
};

export const DEFAULT_BLOCKER_POLICY: BlockerPolicy = {
  completionDays: 40,
  slaRiskDaysRemaining: 7,
  quoteExpiringWithinDays: 1,
};

const DAY = 24 * 60 * 60 * 1000;

/** Whole days from a to b, counting partial days as a day (≥ 0). */
function daysBetweenCeil(a: Date, b: Date): number {
  return Math.max(0, Math.ceil((b.getTime() - a.getTime()) / DAY));
}

export function computeBlockers(s: ProjectSnapshot, now: Date, policy: BlockerPolicy = DEFAULT_BLOCKER_POLICY): Blocker[] {
  const out: Blocker[] = [];
  const stageSince = s.stageEnteredAt;

  switch (s.stage) {
    case "REGISTERED":
    case "DOCUMENTS": {
      for (const type of REQUIRED_DOCUMENTS) {
        const doc = latestDoc(s, type);
        if (!doc) out.push({ code: "DOC_MISSING", owner: "CUSTOMER", severity: "warning", params: { doc: type }, since: stageSince });
        else if (doc.status === "REJECTED")
          out.push({
            code: "DOC_REJECTED",
            owner: "CUSTOMER",
            severity: "critical",
            params: { doc: type, reason: doc.rejectionReason ?? "" },
            since: doc.uploadedAt,
          });
        else if (doc.status === "PENDING")
          out.push({ code: "DOC_REVIEW", owner: "ADMIN", severity: "info", params: { doc: type }, since: doc.uploadedAt });
      }
      const bill = latestDoc(s, "ELECTRICITY_BILL");
      if (bill && bill.status !== "REJECTED" && !s.billConfirmed)
        out.push({ code: "BILL_DATA_UNCONFIRMED", owner: "ADMIN", severity: "info", params: {}, since: bill.uploadedAt });
      break;
    }
    case "SURVEY": {
      if (!s.workerAssigned || !s.survey) {
        out.push({ code: "SURVEY_UNASSIGNED", owner: "ADMIN", severity: "warning", params: {}, since: stageSince });
        break;
      }
      if (s.survey.status !== "SUBMITTED") {
        const overdueDays = Math.floor((now.getTime() - s.survey.scheduledAt.getTime()) / DAY);
        if (overdueDays >= 1)
          out.push({
            code: "SURVEY_OVERDUE",
            owner: "WORKER",
            severity: overdueDays >= 2 ? "critical" : "warning",
            params: { days: overdueDays },
            since: s.survey.scheduledAt,
          });
        else
          out.push({
            code: "SURVEY_SCHEDULED",
            owner: "WORKER",
            severity: "info",
            params: { date: s.survey.scheduledAt.toISOString() },
            since: stageSince,
          });
        if (s.survey.status === "IN_PROGRESS" && !s.survey.hasGeoPhoto)
          out.push({ code: "GEO_PHOTO_MISSING", owner: "WORKER", severity: "warning", params: {}, since: stageSince });
      }
      break;
    }
    case "QUOTE": {
      const q = s.quote;
      if (!q) {
        out.push({ code: "QUOTE_NOT_GENERATED", owner: "ADMIN", severity: "warning", params: {}, since: stageSince });
      } else if (q.status === "DRAFT" || q.status === "PENDING_APPROVAL") {
        out.push({ code: "QUOTE_AWAITING_APPROVAL", owner: "ADMIN", severity: "warning", params: {}, since: q.createdAt });
      } else if (q.status === "EXPIRED" || (q.status !== "ACCEPTED" && now > q.validTill)) {
        out.push({ code: "QUOTE_EXPIRED", owner: "ADMIN", severity: "critical", params: {}, since: q.validTill });
      } else if (q.status === "APPROVED" || q.status === "SENT") {
        const daysLeft = daysBetweenCeil(now, q.validTill);
        if (daysLeft <= policy.quoteExpiringWithinDays)
          out.push({ code: "QUOTE_EXPIRING", owner: "CUSTOMER", severity: "critical", params: { days: daysLeft }, since: q.createdAt });
        else
          out.push({ code: "QUOTE_AWAITING_ACCEPTANCE", owner: "CUSTOMER", severity: "warning", params: { days: daysLeft }, since: q.createdAt });
      }
      break;
    }
    case "ADVANCE_PAYMENT": {
      const pending = s.payments.find((p) => p.milestone === "ADVANCE" && p.status === "PENDING_VERIFICATION");
      if (pending) out.push({ code: "PAYMENT_TO_VERIFY", owner: "ADMIN", severity: "warning", params: { milestone: "ADVANCE" }, since: pending.createdAt });
      else if (!milestonePaid(s, "ADVANCE"))
        out.push({ code: "ADVANCE_PENDING", owner: "CUSTOMER", severity: "warning", params: {}, since: stageSince });
      break;
    }
    case "SUBSIDY_APPLICATION":
      out.push({ code: "SUBSIDY_APPLICATION_PENDING", owner: "ADMIN", severity: "info", params: {}, since: stageSince });
      break;
    case "INSTALLATION":
      if (!s.materialDispatchedAt)
        out.push({ code: "MATERIAL_DISPATCH_PENDING", owner: "ADMIN", severity: "info", params: {}, since: stageSince });
      else if (!s.installedAt)
        out.push({ code: "INSTALLATION_PENDING", owner: "WORKER", severity: "info", params: {}, since: s.materialDispatchedAt });
      if (s.installedAt && s.installationPhotoCount < 1)
        out.push({ code: "INSTALL_PHOTOS_MISSING", owner: "WORKER", severity: "warning", params: {}, since: s.installedAt });
      break;
    case "NET_METERING": {
      if (!s.netMeteringFiledAt) {
        out.push({ code: "NET_METERING_FILE_PENDING", owner: "ADMIN", severity: "info", params: {}, since: stageSince });
      } else if (!milestonePaid(s, "BALANCE")) {
        const pending = s.payments.find((p) => p.milestone === "BALANCE" && p.status === "PENDING_VERIFICATION");
        if (pending)
          out.push({ code: "PAYMENT_TO_VERIFY", owner: "ADMIN", severity: "warning", params: { milestone: "BALANCE" }, since: pending.createdAt });
        else out.push({ code: "BALANCE_PENDING", owner: "CUSTOMER", severity: "warning", params: {}, since: s.netMeteringFiledAt });
      }
      break;
    }
    case "COMMISSIONED":
      if (!s.netMeterInstalledAt)
        out.push({ code: "NET_METER_INSTALL_PENDING", owner: "ADMIN", severity: "info", params: {}, since: stageSince });
      break;
    case "SUBSIDY_CREDITED":
      if (!s.subsidyCreditedAt)
        out.push({ code: "SUBSIDY_CREDIT_PENDING", owner: "ADMIN", severity: "info", params: {}, since: stageSince });
      break;
  }

  // 40-day completion SLA runs from the advance until commissioning.
  if (s.advanceReceivedAt && stageIndex(s.stage) < stageIndex("COMMISSIONED")) {
    const deadline = new Date(s.advanceReceivedAt.getTime() + policy.completionDays * DAY);
    const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / DAY);
    if (daysLeft < 0)
      out.push({ code: "SLA_BREACHED", owner: "ADMIN", severity: "critical", params: { days: -daysLeft }, since: deadline });
    else if (daysLeft <= policy.slaRiskDaysRemaining)
      out.push({ code: "SLA_AT_RISK", owner: "ADMIN", severity: "warning", params: { days: daysLeft }, since: s.advanceReceivedAt });
  }

  return out;
}

/** Oldest first (missing `since` sorts last), for the admin panel. */
export function sortBlockersByAge<T extends { since?: Date }>(blockers: T[]): T[] {
  return [...blockers].sort((a, b) => (a.since?.getTime() ?? Infinity) - (b.since?.getTime() ?? Infinity));
}
