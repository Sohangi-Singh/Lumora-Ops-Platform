import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/settings/schema";
import { mergeConsumption, findMonthGaps, normalizeMonthKey } from "@/lib/solar/consumption";
import { computeSizing, deriveLoadCapKw, InsufficientConsumptionDataError, selectMonthsForAverage } from "@/lib/solar/sizing";
import type { MonthlyUnits } from "@/lib/solar/types";

// Lumora's RTS sizing sheet: 7 months totalling 5279 units, load cap 9.89 kW.
const SHEET_MONTHS: MonthlyUnits[] = [
  { month: "2026-04", units: 812 },
  { month: "2026-03", units: 701 },
  { month: "2026-02", units: 655 },
  { month: "2026-01", units: 690 },
  { month: "2025-12", units: 742 },
  { month: "2025-11", units: 806 },
  { month: "2025-10", units: 873 },
];

const sizing = DEFAULT_SETTINGS.sizing;

describe("computeSizing — RTS sheet", () => {
  it("reproduces the sheet: 5279/7 → 754 avg, 25.1/day, 5.03 kW → 5 kW, cap 9.89", () => {
    expect(SHEET_MONTHS.reduce((s, m) => s + m.units, 0)).toBe(5279);
    const r = computeSizing({ months: SHEET_MONTHS, loadCapKw: 9.89, roofAreaSqm: null, settings: sizing });
    expect(r.monthsUsed).toHaveLength(7);
    expect(Math.round(r.avgMonthlyUnits)).toBe(754);
    expect(r.avgDailyUnits).toBeCloseTo(25.1, 1);
    expect(r.requiredKw).toBeCloseTo(5.03, 2);
    expect(r.loadCapKw).toBe(9.89);
    expect(r.recommendedKw).toBe(5);
    expect(r.binding).toBe("CONSUMPTION");
  });

  it("is limited by roof area at 10 m²/kWp", () => {
    const r = computeSizing({ months: SHEET_MONTHS, loadCapKw: 9.89, roofAreaSqm: 32, settings: sizing });
    expect(r.roofCapKw).toBeCloseTo(3.2);
    expect(r.binding).toBe("ROOF_AREA");
    expect(r.recommendedKw).toBe(3);
  });

  it("never rounds up past a cap", () => {
    // roof cap 3.6 kW would round to 4 → must drop to 3
    const r = computeSizing({ months: SHEET_MONTHS, loadCapKw: null, roofAreaSqm: 36, settings: sizing });
    expect(r.rawKw).toBeCloseTo(3.6);
    expect(r.recommendedKw).toBe(3);
    expect(r.roundedDownForCap).toBe(true);
  });

  it("is limited by sanctioned load", () => {
    const r = computeSizing({ months: SHEET_MONTHS, loadCapKw: 4, roofAreaSqm: 100, settings: sizing });
    expect(r.binding).toBe("SANCTIONED_LOAD");
    expect(r.recommendedKw).toBe(4);
  });

  it("uses only the most recent 12 of 24 months", () => {
    const months: MonthlyUnits[] = Array.from({ length: 24 }, (_, i) => {
      const idx = 2026 * 12 + 9 - i;
      return { month: `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`, units: i < 12 ? 600 : 100 };
    });
    const r = computeSizing({ months, loadCapKw: null, roofAreaSqm: null, settings: sizing });
    expect(r.monthsUsed).toHaveLength(12);
    expect(r.avgMonthlyUnits).toBe(600);
  });

  it("requires at least 3 months", () => {
    expect(() => selectMonthsForAverage(SHEET_MONTHS.slice(0, 2), 12, 3)).toThrow(InsufficientConsumptionDataError);
  });

  it("enforces the minimum system size", () => {
    const tiny: MonthlyUnits[] = SHEET_MONTHS.map((m) => ({ ...m, units: 30 }));
    const r = computeSizing({ months: tiny, loadCapKw: null, roofAreaSqm: null, settings: sizing });
    expect(r.recommendedKw).toBe(1);
  });

  it("derives the load cap from sanctioned load, else connected load", () => {
    expect(deriveLoadCapKw({ sanctionedLoadW: 4000, connectedLoadKw: 9.89 })).toBe(4);
    expect(deriveLoadCapKw({ sanctionedLoadW: null, connectedLoadKw: 9.89 })).toBe(9.89);
    expect(deriveLoadCapKw({})).toBeNull();
  });
});

describe("consumption helpers", () => {
  it("normalises month keys", () => {
    expect(normalizeMonthKey("2026/03")).toBe("2026-03");
    expect(normalizeMonthKey("03/2026")).toBe("2026-03");
    expect(normalizeMonthKey("Mar-2026")).toBe("2026-03");
    expect(normalizeMonthKey("Sept 25")).toBe("2025-09");
    expect(normalizeMonthKey("2026-13")).toBeNull();
  });

  it("merges and dedupes by month with MANUAL > BILL > HISTORY", () => {
    const merged = mergeConsumption(
      [{ month: "2026/03", units: 100, source: "HISTORY" }, { month: "2026-02", units: 90, source: "HISTORY" }],
      [{ month: "2026-03", units: 110, source: "BILL" }],
      [{ month: "2026-02", units: 95, source: "MANUAL" }],
    );
    expect(merged).toEqual([
      { month: "2026-03", units: 110, source: "BILL" },
      { month: "2026-02", units: 95, source: "MANUAL" },
    ]);
  });

  it("finds gaps in the month sequence", () => {
    expect(findMonthGaps([{ month: "2025-12", units: 1 }, { month: "2026-02", units: 1 }])).toEqual(["2026-01"]);
  });
});
