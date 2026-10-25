import { describe, expect, it } from "vitest";
import { computeBlockers, sortBlockersByAge } from "@/lib/workflow/blockers";
import { completedThrough, daysAgo, daysFromNow, NOW, snap } from "./helpers";

const codes = (bs: { code: string }[]) => bs.map((b) => b.code);

describe("blockers", () => {
  it("lists missing documents for the customer", () => {
    const b = computeBlockers(snap("DOCUMENTS"), NOW);
    expect(b.filter((x) => x.code === "DOC_MISSING").map((x) => x.params.doc)).toEqual(["ELECTRICITY_BILL", "AADHAAR", "PAN", "CANCELLED_CHEQUE"]);
    expect(b.every((x) => x.owner === "CUSTOMER")).toBe(true);
  });

  it("shows a rejected document with its reason", () => {
    const b = computeBlockers(
      snap("DOCUMENTS", { documents: [{ type: "AADHAAR", status: "REJECTED", rejectionReason: "Blurry, re-upload", uploadedAt: daysAgo(1) }] }),
      NOW,
    );
    const rejected = b.find((x) => x.code === "DOC_REJECTED");
    expect(rejected).toMatchObject({ owner: "CUSTOMER", severity: "critical", params: { doc: "AADHAAR", reason: "Blurry, re-upload" } });
  });

  it("asks the admin to review pending docs and confirm bill data", () => {
    const b = computeBlockers(
      snap("DOCUMENTS", { documents: [{ type: "ELECTRICITY_BILL", status: "PENDING", uploadedAt: daysAgo(1) }] }),
      NOW,
    );
    expect(codes(b.filter((x) => x.owner === "ADMIN"))).toEqual(["DOC_REVIEW", "BILL_DATA_UNCONFIRMED"]);
  });

  it("survey not scheduled → admin", () => {
    expect(computeBlockers(completedThrough("DOCUMENTS", { stage: "SURVEY" }), NOW)).toMatchObject([{ code: "SURVEY_UNASSIGNED", owner: "ADMIN" }]);
  });

  it("survey overdue by 2 days → worker, critical", () => {
    const s = completedThrough("DOCUMENTS", {
      stage: "SURVEY",
      workerAssigned: true,
      survey: { status: "SCHEDULED", scheduledAt: daysAgo(2), hasGeoPhoto: false },
    });
    expect(computeBlockers(s, NOW)).toMatchObject([{ code: "SURVEY_OVERDUE", owner: "WORKER", severity: "critical", params: { days: 2 } }]);
  });

  it("geo photo missing while survey in progress", () => {
    const s = completedThrough("DOCUMENTS", {
      stage: "SURVEY",
      workerAssigned: true,
      survey: { status: "IN_PROGRESS", scheduledAt: daysFromNow(0.2), hasGeoPhoto: false },
    });
    expect(codes(computeBlockers(s, NOW))).toEqual(["SURVEY_SCHEDULED", "GEO_PHOTO_MISSING"]);
  });

  it("quote awaiting approval → admin", () => {
    const s = completedThrough("SURVEY", {
      stage: "QUOTE",
      quote: { status: "PENDING_APPROVAL", validTill: daysFromNow(6), acceptedAt: null, createdAt: daysAgo(1) },
    });
    expect(computeBlockers(s, NOW)).toMatchObject([{ code: "QUOTE_AWAITING_APPROVAL", owner: "ADMIN" }]);
  });

  it("quote expires in 1 day → customer, critical", () => {
    const s = completedThrough("SURVEY", {
      stage: "QUOTE",
      quote: { status: "SENT", validTill: daysFromNow(0.6), acceptedAt: null, createdAt: daysAgo(5) },
    });
    expect(computeBlockers(s, NOW)).toMatchObject([{ code: "QUOTE_EXPIRING", owner: "CUSTOMER", params: { days: 1 } }]);
  });

  it("expired quote → admin must revise", () => {
    const s = completedThrough("SURVEY", {
      stage: "QUOTE",
      quote: { status: "SENT", validTill: daysAgo(1), acceptedAt: null, createdAt: daysAgo(8) },
    });
    expect(codes(computeBlockers(s, NOW))).toEqual(["QUOTE_EXPIRED"]);
  });

  it("advance payment pending → customer; bank transfer to verify → admin", () => {
    const s = completedThrough("QUOTE", { stage: "ADVANCE_PAYMENT" });
    expect(computeBlockers(s, NOW)).toMatchObject([{ code: "ADVANCE_PENDING", owner: "CUSTOMER" }]);
    const v = { ...s, payments: [{ milestone: "ADVANCE" as const, status: "PENDING_VERIFICATION" as const, createdAt: daysAgo(1) }] };
    expect(computeBlockers(v, NOW)).toMatchObject([{ code: "PAYMENT_TO_VERIFY", owner: "ADMIN" }]);
  });

  it("40-day SLA at risk / breached", () => {
    const atRisk = completedThrough("SUBSIDY_APPLICATION", { stage: "INSTALLATION", advanceReceivedAt: daysAgo(35) });
    expect(computeBlockers(atRisk, NOW).find((b) => b.code === "SLA_AT_RISK")?.params.days).toBe(5);
    const breached = { ...atRisk, advanceReceivedAt: daysAgo(45) };
    expect(computeBlockers(breached, NOW).find((b) => b.code === "SLA_BREACHED")?.params.days).toBe(5);
    const commissioned = completedThrough("NET_METERING", { stage: "COMMISSIONED", advanceReceivedAt: daysAgo(45) });
    expect(codes(computeBlockers(commissioned, NOW))).not.toContain("SLA_BREACHED");
  });

  it("net metering: file pending → admin, then balance → customer", () => {
    const s = completedThrough("INSTALLATION", { stage: "NET_METERING" });
    expect(codes(computeBlockers(s, NOW))).toEqual(["NET_METERING_FILE_PENDING"]);
    expect(codes(computeBlockers({ ...s, netMeteringFiledAt: daysAgo(1) }, NOW))).toEqual(["BALANCE_PENDING"]);
  });

  it("completed project has no blockers", () => {
    expect(computeBlockers(completedThrough("SUBSIDY_CREDITED"), NOW)).toEqual([]);
  });

  it("sorts oldest first", () => {
    const sorted = sortBlockersByAge([{ since: daysAgo(1) }, { since: undefined }, { since: daysAgo(5) }]);
    expect(sorted.map((s) => s.since?.getTime())).toEqual([daysAgo(5).getTime(), daysAgo(1).getTime(), undefined]);
  });
});
