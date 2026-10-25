import type { Settings } from "@/lib/settings/schema";

/** PM Surya Ghar central assistance: ₹30k/kW for the first 2 kW, ₹18k for the 3rd, capped. */
export function centralSubsidy(systemKw: number, s: Settings["subsidy"]): number {
  if (systemKw <= 0) return 0;
  const first = Math.min(systemKw, 2) * s.centralPerKwFirst2;
  const third = Math.max(0, Math.min(systemKw - 2, 1)) * s.centralThirdKw;
  return Math.round(Math.min(first + third, s.centralCap));
}

export function stateSubsidy(systemKw: number, s: Settings["subsidy"]): number {
  return systemKw >= 1 ? s.stateAmount : 0;
}

/** Effective ₹/unit from the bill, if plausible; otherwise the configured default. */
export function effectiveTariff(
  bill: { netBillAmount?: number | null; billedUnits?: number | null },
  fallback: number,
): { tariff: number; fromBill: boolean } {
  const amount = bill.netBillAmount ?? 0;
  const units = bill.billedUnits ?? 0;
  if (amount > 0 && units > 0) {
    const t = amount / units;
    if (t >= 2 && t <= 15) return { tariff: t, fromBill: true };
  }
  return { tariff: fallback, fromBill: false };
}

export type EconomicsResult = {
  yearlyGenerationUnits: number;
  annualConsumptionUnits: number;
  selfConsumedUnits: number;
  surplusUnits: number;
  tariffPerUnit: number;
  tariffFromBill: boolean;
  yearlyBillSavings: number;
  yearlyExportCredit: number;
  yearlyBenefit: number;
  centralSubsidy: number;
  stateSubsidy: number;
  totalSubsidy: number;
  grossCost: number;
  netCost: number;
  paybackYears: number | null;
  lifetimeYears: number;
  lifetimeSavings: number;
  lifetimeNetGain: number;
};

export function computeEconomics(args: {
  systemKw: number;
  grossCost: number;
  avgMonthlyUnits: number;
  tariff: { tariff: number; fromBill: boolean };
  sizing: Settings["sizing"];
  subsidy: Settings["subsidy"];
  economics: Settings["economics"];
}): EconomicsResult {
  const { systemKw, grossCost, sizing, economics } = args;
  const yearlyGenerationUnits = systemKw * sizing.unitsPerKwPerDay * 365;
  const annualConsumptionUnits = args.avgMonthlyUnits * 12;
  const selfConsumedUnits = Math.min(yearlyGenerationUnits, annualConsumptionUnits);
  const surplusUnits = Math.max(0, yearlyGenerationUnits - annualConsumptionUnits);
  const yearlyBillSavings = selfConsumedUnits * args.tariff.tariff;
  const yearlyExportCredit = surplusUnits * economics.exportTariffPerUnit;
  const yearlyBenefit = yearlyBillSavings + yearlyExportCredit;

  const central = centralSubsidy(systemKw, args.subsidy);
  const state = stateSubsidy(systemKw, args.subsidy);
  const totalSubsidy = central + state;
  const netCost = Math.max(0, grossCost - totalSubsidy);

  const d = economics.panelDegradationPctPerYear / 100;
  let lifetimeSavings = 0;
  for (let y = 0; y < economics.analysisYears; y++) lifetimeSavings += yearlyBenefit * Math.pow(1 - d, y);

  return {
    yearlyGenerationUnits,
    annualConsumptionUnits,
    selfConsumedUnits,
    surplusUnits,
    tariffPerUnit: args.tariff.tariff,
    tariffFromBill: args.tariff.fromBill,
    yearlyBillSavings,
    yearlyExportCredit,
    yearlyBenefit,
    centralSubsidy: central,
    stateSubsidy: state,
    totalSubsidy,
    grossCost,
    netCost,
    paybackYears: yearlyBenefit > 0 ? netCost / yearlyBenefit : null,
    lifetimeYears: economics.analysisYears,
    lifetimeSavings,
    lifetimeNetGain: lifetimeSavings - netCost,
  };
}
