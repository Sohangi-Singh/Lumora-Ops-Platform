import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/settings/schema";
import { amountInWords, numberToIndianWords } from "@/lib/solar/amountInWords";
import { buildLineItems, estimateCables, panelCount } from "@/lib/solar/bom";
import { centralSubsidy, computeEconomics, effectiveTariff } from "@/lib/solar/economics";
import { computeBasicPerWp, computePricing, findPricingSlab, NoPricingSlabError, paymentSchedule } from "@/lib/solar/pricing";
import { CATALOG_SEED, PRICING_SLAB_SEED } from "@/prisma/seed-data";

const S = DEFAULT_SETTINGS;

describe("pricing", () => {
  it("5 kW at ₹70,200/kW → ₹3,51,000 with words", () => {
    const slab = findPricingSlab(PRICING_SLAB_SEED, 5, "THREE");
    expect(slab.ratePerKwInclGst).toBe(70200);
    const p = computePricing({ systemKw: 5, ratePerKwInclGst: slab.ratePerKwInclGst, gst: S.gst, payment: S.payment, basicPerWpMethod: "SPLIT_OF_INCLUSIVE" });
    expect(p.totalInclGst).toBe(351000);
    expect(p.totalInWords).toBe("Three Lakh Fifty-One Thousand Only");
    expect(p.advanceAmount).toBe(315900);
    expect(p.balanceAmount).toBe(35100);
    expect(p.goodsValueInclGst).toBeCloseTo(245700);
    expect(p.servicesValueInclGst).toBeCloseTo(105300);
  });

  it("basic per Wp matches the sample quote (64.645) within 0.005", () => {
    const v = computeBasicPerWp(351000, 5000, S.gst, "SPLIT_OF_INCLUSIVE");
    expect(Math.abs(v - 64.645)).toBeLessThan(0.005);
    expect(computeBasicPerWp(351000, 5000, S.gst, "BLENDED_RATE")).toBeCloseTo(64.463, 3);
  });

  it("splits advance/balance without losing a rupee", () => {
    const { advanceAmount, balanceAmount } = paymentSchedule(351001, S.payment);
    expect(advanceAmount + balanceAmount).toBe(351001);
  });

  it("throws when no slab covers the size", () => {
    expect(() => findPricingSlab(PRICING_SLAB_SEED, 500, "THREE")).toThrow(NoPricingSlabError);
  });

  it("prefers a phase-specific slab", () => {
    const slabs = [
      { minKw: 1, maxKw: 10, ratePerKwInclGst: 70000, phase: null },
      { minKw: 1, maxKw: 10, ratePerKwInclGst: 72000, phase: "THREE" as const },
    ];
    expect(findPricingSlab(slabs, 5, "THREE").ratePerKwInclGst).toBe(72000);
    expect(findPricingSlab(slabs, 5, "SINGLE").ratePerKwInclGst).toBe(70000);
  });
});

describe("amount in words (Indian system)", () => {
  it.each([
    [0, "Zero"],
    [7, "Seven"],
    [21, "Twenty-One"],
    [100, "One Hundred"],
    [1005, "One Thousand Five"],
    [45678, "Forty-Five Thousand Six Hundred Seventy-Eight"],
    [100000, "One Lakh"],
    [351000, "Three Lakh Fifty-One Thousand"],
    [1108000, "Eleven Lakh Eight Thousand"],
    [12345678, "One Crore Twenty-Three Lakh Forty-Five Thousand Six Hundred Seventy-Eight"],
  ])("%i → %s", (n, words) => {
    expect(numberToIndianWords(n)).toBe(words);
  });

  it("appends Only and rounds", () => {
    expect(amountInWords(70200.4)).toBe("Seventy Thousand Two Hundred Only");
  });
});

describe("bill of materials", () => {
  it("5 kW / 600 Wp → 8 panels", () => {
    expect(panelCount(5, 600)).toBe(8);
    expect(panelCount(3, 540)).toBe(6);
  });

  it("builds the sample quote's 9 rows with quantities", () => {
    const rows = buildLineItems(CATALOG_SEED, { systemKw: 5, phase: "THREE", panelWattage: 600, panelCount: 8, earthingCount: 3 });
    expect(rows).toHaveLength(9);
    expect(rows[0].quantity).toBe("08");
    expect(rows[0].specification).toContain("600 Wp series");
    expect(rows[1].specification).toContain("**5 kW, Three Phase**");
    expect(rows[1].quantity).toBe("01");
    expect(rows[4].quantity).toBe("03");
    expect(rows[5].quantity).toBe("As per Site Condition");
    expect(rows[8].warranty).toBe("**5 Years**");
  });

  it("estimates cable runs with slack", () => {
    const c = estimateCables(
      { panelToInverterVerticalM: 6, panelToInverterHorizontalM: 4, inverterToMeterM: 10, roofToMeterVerticalM: 6, roofToMeterHorizontalM: 8 },
      15,
    );
    expect(c).toEqual({ dcRunM: 23, acRunM: 12, earthingRunM: 17 });
    expect(estimateCables({}, 15)).toEqual({ dcRunM: null, acRunM: null, earthingRunM: null });
  });
});

describe("customer economics", () => {
  it("PM Surya Ghar central subsidy slabs", () => {
    expect(centralSubsidy(1, S.subsidy)).toBe(30000);
    expect(centralSubsidy(2, S.subsidy)).toBe(60000);
    expect(centralSubsidy(3, S.subsidy)).toBe(78000);
    expect(centralSubsidy(5, S.subsidy)).toBe(78000);
  });

  it("5 kW: ₹1,08,000 subsidy, net ₹2,43,000, positive payback", () => {
    const e = computeEconomics({
      systemKw: 5,
      grossCost: 351000,
      avgMonthlyUnits: 754,
      tariff: { tariff: 6.5, fromBill: false },
      sizing: S.sizing,
      subsidy: S.subsidy,
      economics: S.economics,
    });
    expect(e.yearlyGenerationUnits).toBe(9125);
    expect(e.totalSubsidy).toBe(108000);
    expect(e.netCost).toBe(243000);
    expect(e.surplusUnits).toBeCloseTo(9125 - 754 * 12);
    expect(e.yearlyExportCredit).toBeCloseTo(e.surplusUnits * 1.95);
    expect(e.paybackYears).toBeGreaterThan(3);
    expect(e.paybackYears).toBeLessThan(5);
    expect(e.lifetimeSavings).toBeGreaterThan(e.yearlyBenefit * 20);
  });

  it("derives tariff from the bill only when plausible", () => {
    expect(effectiveTariff({ netBillAmount: 13350, billedUnits: 1591 }, 6.5).fromBill).toBe(true);
    expect(effectiveTariff({ netBillAmount: 100, billedUnits: 1591 }, 6.5)).toEqual({ tariff: 6.5, fromBill: false });
  });
});
