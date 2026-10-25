import type { Settings } from "@/lib/settings/schema";
import { mergeConsumption } from "./consumption";
import type { MonthlyUnits } from "./types";

export type BindingConstraint = "CONSUMPTION" | "SANCTIONED_LOAD" | "ROOF_AREA";

export type SizingInput = {
  months: MonthlyUnits[];
  /** Max RTS capacity allowed by the connection (kW); null if unknown */
  loadCapKw: number | null;
  /** South-facing shadow-free roof area from the survey (m²); null if unknown */
  roofAreaSqm: number | null;
  settings: Settings["sizing"];
};

export type SizingResult = {
  monthsUsed: MonthlyUnits[];
  totalUnits: number;
  avgMonthlyUnits: number;
  avgDailyUnits: number;
  requiredKw: number;
  loadCapKw: number | null;
  roofCapKw: number | null;
  /** min(required, caps) before rounding */
  rawKw: number;
  recommendedKw: number;
  binding: BindingConstraint;
  /** true when rounding to the step was pulled down to stay under a cap */
  roundedDownForCap: boolean;
  /** a cap is smaller than the minimum system size — needs an admin decision */
  capBelowMinimum: boolean;
};

export class InsufficientConsumptionDataError extends Error {
  constructor(
    readonly available: number,
    readonly required: number,
  ) {
    super(`Need at least ${required} months of consumption, got ${available}`);
    this.name = "InsufficientConsumptionDataError";
  }
}

/** Most recent N months (deduped, newest first). Throws if fewer than `min`. */
export function selectMonthsForAverage(months: MonthlyUnits[], max: number, min: number): MonthlyUnits[] {
  const merged = mergeConsumption(months).filter((m) => m.units >= 0);
  if (merged.length < min) throw new InsufficientConsumptionDataError(merged.length, min);
  return merged.slice(0, max);
}

/** Max RTS capacity from the bill: sanctioned (contract) load, else connected load. */
export function deriveLoadCapKw(bill: { sanctionedLoadW?: number | null; connectedLoadKw?: number | null }): number | null {
  if (bill.sanctionedLoadW && bill.sanctionedLoadW > 0) return bill.sanctionedLoadW / 1000;
  if (bill.connectedLoadKw && bill.connectedLoadKw > 0) return bill.connectedLoadKw;
  return null;
}

const EPS = 1e-9;

/**
 * RTS sizing exactly as Lumora's sheet does it:
 *   avgMonthly = Σunits / months; avgDaily = avgMonthly / 30;
 *   requiredKw = avgDaily / unitsPerKwPerDay;
 *   recommended = round(min(required, loadCap, roofCap)) to the step,
 *   never rounding *up* past a physical/regulatory cap.
 */
export function computeSizing(input: SizingInput): SizingResult {
  const { settings } = input;
  const monthsUsed = selectMonthsForAverage(input.months, settings.maxMonthsForAverage, settings.minMonthsForAverage);
  const totalUnits = monthsUsed.reduce((sum, m) => sum + m.units, 0);
  const avgMonthlyUnits = totalUnits / monthsUsed.length;
  const avgDailyUnits = avgMonthlyUnits / 30;
  const requiredKw = avgDailyUnits / settings.unitsPerKwPerDay;

  const loadCapKw = input.loadCapKw && input.loadCapKw > 0 ? input.loadCapKw : null;
  const roofCapKw = input.roofAreaSqm && input.roofAreaSqm > 0 ? input.roofAreaSqm / settings.sqmPerKwp : null;

  let rawKw = requiredKw;
  let binding: BindingConstraint = "CONSUMPTION";
  if (loadCapKw !== null && loadCapKw < rawKw) {
    rawKw = loadCapKw;
    binding = "SANCTIONED_LOAD";
  }
  if (roofCapKw !== null && roofCapKw < rawKw) {
    rawKw = roofCapKw;
    binding = "ROOF_AREA";
  }

  const step = settings.roundingStepKw;
  const hardCap = Math.min(loadCapKw ?? Infinity, roofCapKw ?? Infinity);
  let recommendedKw = Math.round(rawKw / step) * step;
  let roundedDownForCap = false;
  if (recommendedKw > hardCap + EPS) {
    recommendedKw = Math.floor((hardCap + EPS) / step) * step;
    roundedDownForCap = true;
  }
  // Smallest sellable system. If a cap is below even that, flag it for the admin.
  const capBelowMinimum = hardCap < settings.minSystemKw;
  if (recommendedKw < settings.minSystemKw) recommendedKw = settings.minSystemKw;
  recommendedKw = Number(recommendedKw.toFixed(3));

  return {
    monthsUsed,
    totalUnits,
    avgMonthlyUnits,
    avgDailyUnits,
    requiredKw,
    loadCapKw,
    roofCapKw,
    rawKw,
    recommendedKw,
    binding,
    roundedDownForCap,
    capBelowMinimum,
  };
}
