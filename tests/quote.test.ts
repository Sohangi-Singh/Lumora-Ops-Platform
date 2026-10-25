import { describe, expect, it } from "vitest";
import { formatOrdinalDate } from "@/lib/format";
import { DEFAULT_SETTINGS } from "@/lib/settings/schema";
import { composeQuote, isQuoteExpired, validTillDate, type QuoteInputs } from "@/lib/solar/quote";
import { CATALOG_SEED, PRICING_SLAB_SEED } from "@/prisma/seed-data";

const MONTHS = ["2026-04", "2026-03", "2026-02", "2026-01", "2025-12", "2025-11", "2025-10"];
const inputs: QuoteInputs = {
  bill: {
    monthlyConsumption: [812, 701, 655, 690, 742, 806, 873].map((units, i) => ({ month: MONTHS[i], units })),
    sanctionedLoadW: null,
    connectedLoadKw: 9.89,
    phase: "THREE",
    netBillAmount: 6200,
    billedUnits: 812,
  },
  survey: { roofAreaSqm: 64, phaseObserved: "THREE", panelToInverterVerticalM: 4, panelToInverterHorizontalM: 6, inverterToMeterM: 5 },
  overrides: {},
  catalog: CATALOG_SEED,
  slabs: PRICING_SLAB_SEED,
  settings: DEFAULT_SETTINGS,
  quoteDate: new Date("2026-10-19T05:00:00Z"),
};

describe("composeQuote — end-to-end pure pipeline", () => {
  it("reproduces the sample quotation: 5 kW, 8 panels, ₹3,51,000, valid till 25 Oct", () => {
    const q = composeQuote(inputs);
    expect(q.systemKw).toBe(5);
    expect(q.phase).toBe("THREE");
    expect(q.panelCount).toBe(8);
    expect(q.pricing.totalInclGst).toBe(351000);
    expect(q.pricing.totalInWords).toBe("Three Lakh Fifty-One Thousand Only");
    expect(q.lineItems[0].quantity).toBe("08");
    expect(formatOrdinalDate(q.validTill)).toBe("25th October 2026");
    expect(q.sizing.binding).toBe("CONSUMPTION");
    expect(q.cables.dcRunM).toBe(23);
  });

  it("applies admin overrides and flags them", () => {
    const q = composeQuote({ ...inputs, overrides: { systemKw: 4, phase: "SINGLE", reason: "Customer budget" } });
    expect(q.systemKw).toBe(4);
    expect(q.phase).toBe("SINGLE");
    expect(q.panelCount).toBe(7);
    expect(q.pricing.totalInclGst).toBe(280800);
    expect(q.overridden).toEqual({ systemKw: true, phase: true, panelCount: false });
    expect(q.lineItems[1].specification).toContain("**4 kW, Single Phase**");
  });

  it("validity ends at 23:59:59 IST on the last day", () => {
    const till = validTillDate(new Date("2026-10-19T05:00:00Z"), 6);
    expect(isQuoteExpired(till, new Date("2026-10-25T18:00:00Z"))).toBe(false); // 25 Oct 23:30 IST
    expect(isQuoteExpired(till, new Date("2026-10-25T18:31:00Z"))).toBe(true); // 26 Oct 00:01 IST
  });
});
