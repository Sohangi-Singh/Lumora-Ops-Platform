export type PhaseType = "SINGLE" | "THREE";

/** One billing month of consumption. `month` is "YYYY-MM". */
export type MonthlyUnits = {
  month: string;
  units: number;
  source?: "BILL" | "HISTORY" | "MANUAL";
};

export const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function phaseLabel(phase: PhaseType): "Single" | "Three" {
  return phase === "THREE" ? "Three" : "Single";
}
