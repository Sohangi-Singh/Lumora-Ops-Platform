import { findMonthGaps, mergeConsumption } from "@/lib/solar/consumption";
import type { MonthlyUnits } from "@/lib/solar/types";
import type { ExtractedBill } from "./schema";

/**
 * Deterministic cross-checks on extracted bill data. The LLM is treated as an
 * untrusted reader: its output is only as good as these checks say it is, and
 * a human (admin) confirms before anything feeds sizing.
 */

export type CheckCode =
  | "READINGS_CONSISTENT"
  | "MONTHS_CONTINUOUS"
  | "UNITS_POSITIVE"
  | "UNITS_PLAUSIBLE"
  | "ENOUGH_MONTHS"
  | "SERVICE_NO_FORMAT"
  | "LOAD_PRESENT"
  | "SOURCES_AGREE";

export type CheckResult = {
  code: CheckCode;
  ok: boolean;
  critical: boolean;
  /** Short English detail for the admin review screen */
  detail: string;
};

const MAX_RESIDENTIAL_MONTHLY_UNITS = 5000;

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function runBillChecks(bill: ExtractedBill, months: MonthlyUnits[], parser?: ExtractedBill | null): CheckResult[] {
  const checks: CheckResult[] = [];

  if (bill.currentReading !== null && bill.previousReading !== null && bill.billedUnits !== null) {
    const mf = bill.multiplyingFactor && bill.multiplyingFactor > 0 ? bill.multiplyingFactor : 1;
    const expected = (bill.currentReading - bill.previousReading) * mf;
    const tolerance = Math.max(2, bill.billedUnits * 0.01);
    const ok = Math.abs(expected - bill.billedUnits) <= tolerance;
    checks.push({
      code: "READINGS_CONSISTENT",
      ok,
      critical: true,
      detail: ok
        ? `${bill.previousReading} + ${bill.billedUnits} ≈ ${bill.currentReading}`
        : `previous ${bill.previousReading} + units ${bill.billedUnits} ≠ current ${bill.currentReading}`,
    });
  } else {
    checks.push({ code: "READINGS_CONSISTENT", ok: false, critical: false, detail: "Readings not fully available" });
  }

  const gaps = findMonthGaps(months);
  checks.push({
    code: "MONTHS_CONTINUOUS",
    ok: gaps.length === 0,
    critical: false,
    detail: gaps.length ? `Missing months: ${gaps.join(", ")}` : `${months.length} consecutive months`,
  });

  const nonPositive = months.filter((m) => !(m.units > 0));
  checks.push({
    code: "UNITS_POSITIVE",
    ok: nonPositive.length === 0,
    critical: true,
    detail: nonPositive.length ? `Zero/negative units in ${nonPositive.map((m) => m.month).join(", ")}` : "All months > 0",
  });

  const med = months.length ? median(months.map((m) => m.units)) : 0;
  const outliers = months.filter((m) => m.units > MAX_RESIDENTIAL_MONTHLY_UNITS || (med > 0 && m.units > med * 4));
  checks.push({
    code: "UNITS_PLAUSIBLE",
    ok: outliers.length === 0,
    critical: false,
    detail: outliers.length ? `Unusual values: ${outliers.map((m) => `${m.month}=${m.units}`).join(", ")}` : `Median ${Math.round(med)} units/month`,
  });

  checks.push({
    code: "ENOUGH_MONTHS",
    ok: months.length >= 3,
    critical: true,
    detail: `${months.length} month(s) of consumption`,
  });

  checks.push({
    code: "SERVICE_NO_FORMAT",
    ok: Boolean(bill.serviceNo && /^\d{10}$/.test(bill.serviceNo)),
    critical: false,
    detail: bill.serviceNo ? `Service no. ${bill.serviceNo}` : "Service number not found",
  });

  checks.push({
    code: "LOAD_PRESENT",
    ok: Boolean((bill.sanctionedLoadW ?? 0) > 0 || (bill.connectedLoadKw ?? 0) > 0),
    critical: false,
    detail: bill.sanctionedLoadW ? `Sanctioned load ${bill.sanctionedLoadW} W` : "Load not found",
  });

  if (parser) {
    const pairs: [string, unknown, unknown][] = [
      ["serviceNo", bill.serviceNo, parser.serviceNo],
      ["sanctionedLoadW", bill.sanctionedLoadW, parser.sanctionedLoadW],
      ["currentReading", bill.currentReading, parser.currentReading],
      ["previousReading", bill.previousReading, parser.previousReading],
      ["billedUnits", bill.billedUnits, parser.billedUnits],
    ];
    const compared = pairs.filter(([, a, b]) => a !== null && b !== null);
    const mismatched = compared.filter(([, a, b]) => String(a) !== String(b)).map(([k]) => k);
    checks.push({
      code: "SOURCES_AGREE",
      ok: compared.length > 0 && mismatched.length === 0,
      critical: mismatched.length > 0,
      detail:
        compared.length === 0
          ? "No overlapping fields between PDF text and vision"
          : mismatched.length
            ? `PDF text and vision disagree on: ${mismatched.join(", ")}`
            : `PDF text and vision agree on ${compared.length} fields`,
    });
  }

  return checks;
}

export function scoreConfidence(modelConfidence: number | null, checks: CheckResult[]): number {
  let score = modelConfidence ?? 0.7;
  for (const c of checks) {
    if (c.ok) continue;
    score -= c.critical ? 0.2 : 0.05;
  }
  if (checks.some((c) => c.code === "SOURCES_AGREE" && c.ok)) score += 0.1;
  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}

export const REVIEW_THRESHOLD = 0.75;

export function needsReview(confidence: number, checks: CheckResult[]): boolean {
  return confidence < REVIEW_THRESHOLD || checks.some((c) => c.critical && !c.ok);
}

/**
 * Combine everything we know into one record: vision result wins per field,
 * the text parser fills gaps, and consumption months from bill + app history
 * are merged and deduped.
 */
export function mergeExtractions(
  primary: ExtractedBill | null,
  parser: ExtractedBill | null,
  history: ExtractedBill[] = [],
): { bill: ExtractedBill; months: MonthlyUnits[] } {
  const base = (primary ?? parser) as ExtractedBill;
  const pick = <K extends keyof ExtractedBill>(k: K): ExtractedBill[K] => (primary?.[k] ?? parser?.[k] ?? base[k]) as ExtractedBill[K];
  const bill: ExtractedBill = {
    ...base,
    serviceNo: pick("serviceNo"),
    consumerName: pick("consumerName"),
    billAddress: pick("billAddress"),
    purpose: pick("purpose"),
    tariffCategory: pick("tariffCategory"),
    sanctionedLoadW: pick("sanctionedLoadW"),
    connectedLoadKw: pick("connectedLoadKw"),
    phase: pick("phase"),
    billMonth: pick("billMonth"),
    currentReading: pick("currentReading"),
    previousReading: pick("previousReading"),
    multiplyingFactor: pick("multiplyingFactor"),
    billedUnits: pick("billedUnits"),
    netBillAmount: pick("netBillAmount"),
    existingSolarExport: pick("existingSolarExport"),
  };
  const months = mergeConsumption(
    (primary?.monthlyConsumption ?? []).map((m) => ({ ...m, source: "BILL" as const })),
    (parser?.monthlyConsumption ?? []).map((m) => ({ ...m, source: "BILL" as const })),
    ...history.map((h) => h.monthlyConsumption.map((m) => ({ ...m, source: "HISTORY" as const }))),
  );
  return { bill: { ...bill, monthlyConsumption: months }, months };
}
