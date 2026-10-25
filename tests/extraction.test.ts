import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mergeExtractions, needsReview, runBillChecks, scoreConfidence } from "@/lib/extraction/checks";
import { parseCspdclText } from "@/lib/extraction/cspdclParser";
import { ExtractedBillSchema } from "@/lib/extraction/schema";

// Synthetic bill text in the exact shape pdf.js produces for a CSPDCL LT bill
// (fictional consumer — real bills are never committed).
const TEXT = readFileSync(new URL("./fixtures/cspdcl-bill.txt", import.meta.url), "utf8");

describe("CSPDCL text-layer parser", () => {
  const p = parseCspdclText(TEXT);

  it("pulls the key fields out of garbled Hindi text", () => {
    expect(p.serviceNo).toBe("1002345678");
    expect(p.billMonth).toBe("2026-04");
    expect(p.sanctionedLoadW).toBe(3000);
    expect(p.currentReading).toBe(54321);
    expect(p.previousReading).toBe(53891);
    expect(p.billedUnits).toBe(430);
    expect(p.netBillAmount).toBe(2410);
    expect(p.consumerName).toBe("SHRI RAMESH KUMAR VERMA");
    expect(p.tariffCategory).toBe("LV1DL1SR25");
    expect(p.purpose).toBe("Residential Connection");
    expect(p.existingSolarExport).toBe(0);
    expect(p.billAddress).toContain("SHANTI NAGAR");
  });

  it("reads the bill month plus the previous-6-readings table (7 months)", () => {
    expect(p.monthlyConsumption.map((m) => m.month)).toEqual(["2026-04", "2026-03", "2026-02", "2026-01", "2025-12", "2025-11", "2025-10"]);
    expect(p.monthlyConsumption[0].units).toBe(430);
    expect(p.fieldsFound).toBeGreaterThanOrEqual(8);
  });

  it("never throws on junk", () => {
    const junk = parseCspdclText("hello world");
    expect(junk.serviceNo).toBeNull();
    expect(junk.monthlyConsumption).toEqual([]);
  });
});

describe("extraction schema", () => {
  it("coerces model output defensively", () => {
    const parsed = ExtractedBillSchema.parse({
      documentKind: "CSPDCL_BILL",
      sanctionedLoadW: "4,000",
      netBillAmount: "₹13,350.00",
      serviceNo: "  ",
      monthlyConsumption: [{ month: "2026/03", units: "1152" }, { month: "2026/02", units: null }],
      confidence: 0.9,
    });
    expect(parsed.sanctionedLoadW).toBe(4000);
    expect(parsed.netBillAmount).toBe(13350);
    expect(parsed.serviceNo).toBeNull();
    expect(parsed.monthlyConsumption).toEqual([{ month: "2026/03", units: 1152 }]);
  });
});

describe("cross-checks and confidence", () => {
  const parser = parseCspdclText(TEXT);

  it("passes every check for a clean bill where vision and text agree", () => {
    const vision = { ...parser, confidence: 0.9 };
    const { bill, months } = mergeExtractions(vision, parser);
    const checks = runBillChecks(bill, months, parser);
    expect(checks.filter((c) => !c.ok)).toEqual([]);
    const confidence = scoreConfidence(0.9, checks);
    expect(confidence).toBe(1);
    expect(needsReview(confidence, checks)).toBe(false);
  });

  it("flags inconsistent readings and disagreement for review", () => {
    const vision = { ...parser, currentReading: 55321, confidence: 0.95 };
    const { bill, months } = mergeExtractions(vision, parser);
    const checks = runBillChecks(bill, months, parser);
    expect(checks.find((c) => c.code === "READINGS_CONSISTENT")?.ok).toBe(false);
    expect(checks.find((c) => c.code === "SOURCES_AGREE")?.detail).toContain("currentReading");
    expect(needsReview(scoreConfidence(0.95, checks), checks)).toBe(true);
  });

  it("flags gaps, zeros and outliers", () => {
    const months = [
      { month: "2026-04", units: 400 },
      { month: "2026-02", units: 0 },
      { month: "2026-01", units: 9000 },
    ];
    const checks = runBillChecks({ ...parser, monthlyConsumption: months }, months);
    const failed = checks.filter((c) => !c.ok).map((c) => c.code);
    expect(failed).toEqual(expect.arrayContaining(["MONTHS_CONTINUOUS", "UNITS_POSITIVE", "UNITS_PLAUSIBLE"]));
  });

  it("merges app history months with bill months, bill wins on overlap", () => {
    const history = { ...parser, documentKind: "CONSUMPTION_HISTORY" as const, monthlyConsumption: [
      { month: "2026-03", units: 999 },
      { month: "2025-09", units: 500 },
      { month: "2025-08", units: 520 },
    ] };
    const { months } = mergeExtractions(null, parser, [history]);
    expect(months).toHaveLength(9);
    expect(months.find((m) => m.month === "2026-03")?.units).toBe(402);
    expect(months.find((m) => m.month === "2025-09")?.source).toBe("HISTORY");
  });
});
