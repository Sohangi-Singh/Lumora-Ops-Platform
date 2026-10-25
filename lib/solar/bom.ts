import type { Settings } from "@/lib/settings/schema";
import { phaseLabel, type PhaseType } from "./types";

export type CatalogItemInput = {
  sortOrder: number;
  category: string;
  description: string;
  specification: string;
  make: string;
  warranty: string;
  unit: string;
  /** PANEL_COUNT | ONE | EARTHING | FIXED | TEXT */
  qtyRule: string;
  fixedQty: number | null;
  qtyText: string | null;
  isActive?: boolean;
};

export type LineItem = {
  sNo: number;
  category: string;
  description: string;
  specification: string;
  make: string;
  warranty: string;
  unit: string;
  quantity: string;
};

/** 5 kW with 600 Wp modules → 8 panels (as in the sample quote). */
export function panelCount(systemKw: number, panelWattage: number): number {
  if (panelWattage <= 0) throw new RangeError("Panel wattage must be positive");
  return Math.max(1, Math.round((systemKw * 1000) / panelWattage));
}

export type SurveyDistances = {
  roofToMeterVerticalM?: number | null;
  roofToMeterHorizontalM?: number | null;
  panelToInverterVerticalM?: number | null;
  panelToInverterHorizontalM?: number | null;
  inverterToMeterM?: number | null;
};

export type CableEstimate = { dcRunM: number | null; acRunM: number | null; earthingRunM: number | null };

/**
 * Indicative cable lengths (stored for procurement; the PDF still prints
 * "As per Site Condition"). DC is a +/− pair, so ×2, plus slack.
 */
export function estimateCables(d: SurveyDistances, slackPct: number): CableEstimate {
  const n = (v: number | null | undefined) => (typeof v === "number" && v >= 0 ? v : null);
  const pv = n(d.panelToInverterVerticalM);
  const ph = n(d.panelToInverterHorizontalM);
  const ac = n(d.inverterToMeterM);
  const rv = n(d.roofToMeterVerticalM);
  const rh = n(d.roofToMeterHorizontalM);
  const slack = 1 + slackPct / 100;
  return {
    dcRunM: pv !== null && ph !== null ? Math.ceil((pv + ph) * 2 * slack) : null,
    acRunM: ac !== null ? Math.ceil(ac * slack) : null,
    earthingRunM: rv !== null && rh !== null ? Math.ceil((rv + rh) * slack) : null,
  };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function formatKw(kw: number): string {
  return Number.isInteger(kw) ? String(kw) : String(Number(kw.toFixed(2)));
}

/** Replace {kW} {phase} {panelWattage} placeholders. */
export function fillTemplate(text: string, ctx: { systemKw: number; phase: PhaseType; panelWattage: number }): string {
  return text
    .replaceAll("{kW}", formatKw(ctx.systemKw))
    .replaceAll("{phase}", phaseLabel(ctx.phase))
    .replaceAll("{panelWattage}", String(ctx.panelWattage));
}

export function buildLineItems(
  catalog: CatalogItemInput[],
  ctx: { systemKw: number; phase: PhaseType; panelWattage: number; panelCount: number; earthingCount: number },
): LineItem[] {
  return catalog
    .filter((c) => c.isActive !== false)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c, i) => {
      let quantity: string;
      switch (c.qtyRule) {
        case "PANEL_COUNT":
          quantity = pad2(ctx.panelCount);
          break;
        case "ONE":
          quantity = "01";
          break;
        case "EARTHING":
          quantity = pad2(ctx.earthingCount);
          break;
        case "FIXED":
          quantity = pad2(c.fixedQty ?? 0);
          break;
        default:
          quantity = c.qtyText ?? "";
      }
      return {
        sNo: i + 1,
        category: c.category,
        description: fillTemplate(c.description, ctx),
        specification: fillTemplate(c.specification, ctx),
        make: fillTemplate(c.make, ctx),
        warranty: fillTemplate(c.warranty, ctx),
        unit: c.unit,
        quantity,
      };
    });
}

export type BomSettings = Pick<Settings["quote"], "earthingCount" | "dcCableSlackPct"> & Pick<Settings["sizing"], "panelWattage">;
