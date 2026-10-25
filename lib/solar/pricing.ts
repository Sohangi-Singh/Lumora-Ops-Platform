import type { Settings } from "@/lib/settings/schema";
import { amountInWords } from "./amountInWords";
import type { PhaseType } from "./types";

export type PricingSlabInput = {
  minKw: number;
  maxKw: number;
  ratePerKwInclGst: number;
  phase: PhaseType | null;
  isActive?: boolean;
};

export class NoPricingSlabError extends Error {
  constructor(readonly kw: number) {
    super(`No active pricing slab covers ${kw} kW`);
    this.name = "NoPricingSlabError";
  }
}

/** Slab whose [minKw, maxKw] covers the size; a phase-specific slab beats a generic one. */
export function findPricingSlab(slabs: PricingSlabInput[], kw: number, phase: PhaseType): PricingSlabInput {
  const matches = slabs.filter(
    (s) => s.isActive !== false && kw >= s.minKw - 1e-9 && kw <= s.maxKw + 1e-9 && (s.phase === null || s.phase === phase),
  );
  matches.sort((a, b) => Number(b.phase !== null) - Number(a.phase !== null) || a.maxKw - a.minKw - (b.maxKw - b.minKw));
  if (!matches[0]) throw new NoPricingSlabError(kw);
  return matches[0];
}

/**
 * Per-Wp basic (pre-GST) cost.
 *
 * SPLIT_OF_INCLUSIVE (default): the GST-inclusive contract value is split 70/30,
 *   and GST is backed out of each part: basic = T·(0.70/1.05 + 0.30/1.18) / Wp.
 *   For ₹3,51,000 at 5 kW this gives 64.647 — the sample quote prints 64.645.
 * BLENDED_RATE (as written in the brief): basic = T / (0.70·1.05 + 0.30·1.18) / Wp
 *   → 64.463 for the same inputs.
 *
 * TODO(owner): confirm which formula Lumora uses. SPLIT_OF_INCLUSIVE matches the
 * sample to within ₹0.002/Wp; switch in Admin → Settings → Quote if needed.
 */
export function computeBasicPerWp(
  totalInclGst: number,
  systemWp: number,
  gst: Settings["gst"],
  method: Settings["quote"]["basicPerWpMethod"] = "SPLIT_OF_INCLUSIVE",
): number {
  if (systemWp <= 0) throw new RangeError("System Wp must be positive");
  const g = gst.goodsSharePct / 100;
  const s = gst.servicesSharePct / 100;
  const gr = gst.goodsRatePct / 100;
  const sr = gst.servicesRatePct / 100;
  const basicTotal =
    method === "SPLIT_OF_INCLUSIVE" ? totalInclGst * (g / (1 + gr) + s / (1 + sr)) : totalInclGst / (g * (1 + gr) + s * (1 + sr));
  return basicTotal / systemWp;
}

export type PricingResult = {
  ratePerKwInclGst: number;
  totalInclGst: number;
  totalInWords: string;
  goodsValueInclGst: number;
  servicesValueInclGst: number;
  goodsGst: number;
  servicesGst: number;
  totalGst: number;
  basicTotal: number;
  basicPerWp: number;
  basicPerWpBlended: number;
  advanceAmount: number;
  balanceAmount: number;
};

export function computePricing(args: {
  systemKw: number;
  ratePerKwInclGst: number;
  gst: Settings["gst"];
  payment: Settings["payment"];
  basicPerWpMethod: Settings["quote"]["basicPerWpMethod"];
}): PricingResult {
  const { systemKw, ratePerKwInclGst, gst, payment } = args;
  const totalInclGst = Math.round(ratePerKwInclGst * systemKw);
  const goodsValueInclGst = (totalInclGst * gst.goodsSharePct) / 100;
  const servicesValueInclGst = (totalInclGst * gst.servicesSharePct) / 100;
  const goodsGst = goodsValueInclGst - goodsValueInclGst / (1 + gst.goodsRatePct / 100);
  const servicesGst = servicesValueInclGst - servicesValueInclGst / (1 + gst.servicesRatePct / 100);
  const systemWp = systemKw * 1000;
  const { advanceAmount, balanceAmount } = paymentSchedule(totalInclGst, payment);
  return {
    ratePerKwInclGst,
    totalInclGst,
    totalInWords: amountInWords(totalInclGst),
    goodsValueInclGst,
    servicesValueInclGst,
    goodsGst,
    servicesGst,
    totalGst: goodsGst + servicesGst,
    basicTotal: totalInclGst - goodsGst - servicesGst,
    basicPerWp: computeBasicPerWp(totalInclGst, systemWp, gst, args.basicPerWpMethod),
    basicPerWpBlended: computeBasicPerWp(totalInclGst, systemWp, gst, "BLENDED_RATE"),
    advanceAmount,
    balanceAmount,
  };
}

/** 90/10 split; the balance absorbs rounding so the two always sum to the total. */
export function paymentSchedule(total: number, payment: Settings["payment"]): { advanceAmount: number; balanceAmount: number } {
  const advanceAmount = Math.round((total * payment.advancePct) / 100);
  return { advanceAmount, balanceAmount: total - advanceAmount };
}
