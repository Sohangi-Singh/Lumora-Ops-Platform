import { describe, expect, it } from "vitest";
import {
  assertTransition,
  autoAdvancePath,
  canTransition,
  exitBlockers,
  InvalidTransitionError,
  isProjectComplete,
  nextStage,
  STAGES,
  type Stage,
} from "@/lib/workflow/stateMachine";
import { completedThrough, daysAgo, daysFromNow, snap } from "./helpers";

describe("state machine: every valid transition", () => {
  const pairs = STAGES.slice(0, -1).map((s, i) => [s, STAGES[i + 1]] as [Stage, Stage]);
  it.each(pairs)("%s → %s is allowed once its exit condition holds", (from, to) => {
    const s = completedThrough(from);
    expect(canTransition(s, to)).toEqual({ ok: true });
    expect(() => assertTransition(s, to)).not.toThrow();
  });
});

describe("state machine: invalid transitions", () => {
  const pairs = STAGES.slice(1, -1).map((s, i) => [s, STAGES[i + 2]] as [Stage, Stage]);
  it.each(pairs)("%s → %s is rejected while the stage is incomplete", (from, to) => {
    const s = snap(from);
    const r = canTransition(s, to);
    expect(r.ok).toBe(false);
    expect(() => assertTransition(s, to)).toThrow(InvalidTransitionError);
  });

  it("cannot skip a stage even when everything is done", () => {
    const s = completedThrough("NET_METERING", { stage: "DOCUMENTS" });
    expect(canTransition(s, "QUOTE")).toEqual({ ok: false, reasons: ["NOT_NEXT_STAGE"] });
  });

  it("cannot move backwards", () => {
    expect(canTransition(completedThrough("QUOTE"), "SURVEY")).toEqual({ ok: false, reasons: ["NOT_NEXT_STAGE"] });
  });

  it("cannot move past the final stage", () => {
    expect(canTransition(completedThrough("SUBSIDY_CREDITED"), "SUBSIDY_CREDITED")).toEqual({ ok: false, reasons: ["ALREADY_FINAL"] });
    expect(nextStage("SUBSIDY_CREDITED")).toBeNull();
  });

  it("typed error carries from/to/reasons", () => {
    try {
      assertTransition(snap("DOCUMENTS"), "SURVEY");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidTransitionError);
      const err = e as InvalidTransitionError;
      expect(err.from).toBe("DOCUMENTS");
      expect(err.to).toBe("SURVEY");
      expect(err.reasons).toContain("DOC_MISSING:PAN");
    }
  });
});

describe("stage guards", () => {
  it("DOCUMENTS needs all four approved and bill data confirmed", () => {
    const s = completedThrough("DOCUMENTS", { billConfirmed: false });
    expect(exitBlockers("DOCUMENTS", s)).toEqual(["BILL_NOT_CONFIRMED"]);
    const rejected = completedThrough("DOCUMENTS", {
      documents: completedThrough("DOCUMENTS").documents.map((d) => (d.type === "AADHAAR" ? { ...d, status: "REJECTED" as const } : d)),
    });
    expect(exitBlockers("DOCUMENTS", rejected)).toEqual(["DOC_REJECTED:AADHAAR"]);
  });

  it("SURVEY needs a submitted survey with geo photo", () => {
    const s = completedThrough("SURVEY", { survey: { status: "IN_PROGRESS", scheduledAt: daysAgo(1), hasGeoPhoto: false } });
    expect(exitBlockers("SURVEY", s)).toEqual(["SURVEY_NOT_SUBMITTED", "GEO_PHOTO_MISSING"]);
  });

  it("QUOTE rejects acceptance after validity", () => {
    const s = completedThrough("QUOTE", {
      quote: { status: "ACCEPTED", validTill: daysAgo(2), acceptedAt: daysAgo(1), createdAt: daysAgo(9) },
    });
    expect(exitBlockers("QUOTE", s)).toEqual(["QUOTE_ACCEPTED_AFTER_EXPIRY"]);
    const sent = completedThrough("QUOTE", {
      quote: { status: "SENT", validTill: daysFromNow(2), acceptedAt: null, createdAt: daysAgo(1) },
    });
    expect(exitBlockers("QUOTE", sent)).toEqual(["QUOTE_NOT_ACCEPTED"]);
  });

  it("ADVANCE accepts PAID (Razorpay) or VERIFIED (bank/loan), not pending", () => {
    expect(exitBlockers("ADVANCE_PAYMENT", completedThrough("ADVANCE_PAYMENT", { payments: [{ milestone: "ADVANCE", status: "VERIFIED" }] }))).toEqual([]);
    expect(
      exitBlockers("ADVANCE_PAYMENT", completedThrough("ADVANCE_PAYMENT", { payments: [{ milestone: "ADVANCE", status: "PENDING_VERIFICATION" }] })),
    ).toEqual(["ADVANCE_NOT_PAID"]);
    expect(exitBlockers("ADVANCE_PAYMENT", completedThrough("ADVANCE_PAYMENT", { payments: [{ milestone: "BALANCE", status: "PAID" }] }))).toEqual([
      "ADVANCE_NOT_PAID",
    ]);
  });

  it("NET_METERING needs both filing and balance", () => {
    const s = completedThrough("NET_METERING", { payments: [{ milestone: "ADVANCE", status: "PAID" }] });
    expect(exitBlockers("NET_METERING", s)).toEqual(["BALANCE_NOT_PAID"]);
  });

  it("INSTALLATION needs dispatch, install and photos", () => {
    expect(exitBlockers("INSTALLATION", snap("INSTALLATION"))).toEqual(["MATERIAL_NOT_DISPATCHED", "NOT_INSTALLED", "INSTALLATION_PHOTOS_MISSING"]);
  });
});

describe("auto-advance", () => {
  it("walks forward through every satisfied stage and stops at the first unmet one", () => {
    const s = completedThrough("ADVANCE_PAYMENT", { stage: "DOCUMENTS" });
    expect(autoAdvancePath(s)).toEqual(["SURVEY", "QUOTE", "ADVANCE_PAYMENT", "SUBSIDY_APPLICATION"]);
  });

  it("REGISTERED → DOCUMENTS immediately", () => {
    expect(autoAdvancePath(snap("REGISTERED"))).toEqual(["DOCUMENTS"]);
  });

  it("does nothing when blocked", () => {
    expect(autoAdvancePath(snap("SURVEY"))).toEqual([]);
  });

  it("knows when the project is complete", () => {
    expect(isProjectComplete(completedThrough("SUBSIDY_CREDITED"))).toBe(true);
    expect(isProjectComplete(completedThrough("COMMISSIONED", { stage: "SUBSIDY_CREDITED" }))).toBe(false);
  });
});
