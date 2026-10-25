import type { Settings } from "@/lib/settings/schema";
import { istDateParts } from "@/lib/format";
import { buildLineItems, estimateCables, panelCount, type CableEstimate, type CatalogItemInput, type LineItem, type SurveyDistances } from "./bom";
import { computeEconomics, effectiveTariff, type EconomicsResult } from "./economics";
import { computePricing, findPricingSlab, type PricingResult, type PricingSlabInput } from "./pricing";
import { computeSizing, deriveLoadCapKw, type SizingResult } from "./sizing";
import type { MonthlyUnits, PhaseType } from "./types";

export type QuoteOverrides = {
  systemKw?: number | null;
  phase?: PhaseType | null;
  panelCount?: number | null;
  reason?: string | null;
};

export type QuoteInputs = {
  bill: {
    monthlyConsumption: MonthlyUnits[];
    sanctionedLoadW: number | null;
    connectedLoadKw: number | null;
    phase: PhaseType | null;
    netBillAmount: number | null;
    billedUnits: number | null;
  };
  survey: SurveyDistances & { roofAreaSqm: number | null; phaseObserved: PhaseType | null };
  overrides: QuoteOverrides;
  catalog: CatalogItemInput[];
  slabs: PricingSlabInput[];
  settings: Settings;
  quoteDate: Date;
};

export type ComposedQuote = {
  sizing: SizingResult;
  systemKw: number;
  phase: PhaseType;
  panelCount: number;
  panelWattage: number;
  overridden: { systemKw: boolean; phase: boolean; panelCount: boolean };
  lineItems: LineItem[];
  pricing: PricingResult;
  economics: EconomicsResult;
  cables: CableEstimate;
  validTill: Date;
};

/** End of the IST calendar day `days` after `from` (quotes are valid "till" a date). */
export function validTillDate(from: Date, days: number): Date {
  const { year, month, day } = istDateParts(from);
  // 23:59:59 IST == 18:29:59 UTC
  return new Date(Date.UTC(year, month - 1, day + days, 18, 29, 59));
}

export function isQuoteExpired(validTill: Date, now: Date): boolean {
  return now.getTime() > validTill.getTime();
}

/**
 * The whole quote pipeline as one pure function: bill + survey + settings →
 * sizing → BOM → price → customer economics. Persisted verbatim in
 * Quote.inputsSnapshot / computed so every quote is reproducible.
 */
export function composeQuote(inputs: QuoteInputs): ComposedQuote {
  const { settings, bill, survey, overrides } = inputs;
  const sizing = computeSizing({
    months: bill.monthlyConsumption,
    loadCapKw: deriveLoadCapKw(bill),
    roofAreaSqm: survey.roofAreaSqm,
    settings: settings.sizing,
  });

  const systemKw = overrides.systemKw && overrides.systemKw > 0 ? overrides.systemKw : sizing.recommendedKw;
  const phase: PhaseType = overrides.phase ?? bill.phase ?? survey.phaseObserved ?? (systemKw > 5 ? "THREE" : "SINGLE");
  const panelWattage = settings.sizing.panelWattage;
  const panels = overrides.panelCount && overrides.panelCount > 0 ? overrides.panelCount : panelCount(systemKw, panelWattage);

  const lineItems = buildLineItems(inputs.catalog, {
    systemKw,
    phase,
    panelWattage,
    panelCount: panels,
    earthingCount: settings.quote.earthingCount,
  });

  const slab = findPricingSlab(inputs.slabs, systemKw, phase);
  const pricing = computePricing({
    systemKw,
    ratePerKwInclGst: slab.ratePerKwInclGst,
    gst: settings.gst,
    payment: settings.payment,
    basicPerWpMethod: settings.quote.basicPerWpMethod,
  });

  const economics = computeEconomics({
    systemKw,
    grossCost: pricing.totalInclGst,
    avgMonthlyUnits: sizing.avgMonthlyUnits,
    tariff: effectiveTariff(bill, settings.economics.defaultTariffPerUnit),
    sizing: settings.sizing,
    subsidy: settings.subsidy,
    economics: settings.economics,
  });

  return {
    sizing,
    systemKw,
    phase,
    panelCount: panels,
    panelWattage,
    overridden: {
      systemKw: Boolean(overrides.systemKw && overrides.systemKw > 0),
      phase: Boolean(overrides.phase),
      panelCount: Boolean(overrides.panelCount && overrides.panelCount > 0),
    },
    lineItems,
    pricing,
    economics,
    cables: estimateCables(survey, settings.quote.dcCableSlackPct),
    validTill: validTillDate(inputs.quoteDate, settings.quote.validityDays),
  };
}
