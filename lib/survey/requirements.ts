import { z } from "zod";

/**
 * Site-survey requirements, shared by the worker's form (to disable Submit
 * and list exactly what's missing) and the server (to reject incomplete
 * submissions). Distances are metres.
 */

const metres = (max: number) => z.number().finite().min(0).max(max);

export const SurveyFieldsSchema = z.object({
  roofLengthM: metres(200).positive(),
  roofWidthM: metres(200).positive(),
  roofType: z.enum(["RCC", "TIN", "OTHER"]),
  buildingHeightM: metres(200),
  southShadowFree: z.boolean(),
  shadowNotes: z.string().trim().max(1000).nullable(),
  roofToMeterVerticalM: metres(200),
  roofToMeterHorizontalM: metres(500),
  panelToInverterVerticalM: metres(200),
  panelToInverterHorizontalM: metres(500),
  inverterToMeterM: metres(500),
  phaseObserved: z.enum(["SINGLE", "THREE"]),
  notes: z.string().trim().max(2000).nullable(),
});
export type SurveyFields = z.infer<typeof SurveyFieldsSchema>;

export type SurveyDraft = Partial<{ [K in keyof SurveyFields]: SurveyFields[K] | null }>;

export type SurveyPhotos = { roofGeo: number; shadow: number };

export const REQUIRED_FIELDS: (keyof SurveyFields)[] = [
  "roofLengthM",
  "roofWidthM",
  "roofType",
  "buildingHeightM",
  "southShadowFree",
  "roofToMeterVerticalM",
  "roofToMeterHorizontalM",
  "panelToInverterVerticalM",
  "panelToInverterHorizontalM",
  "inverterToMeterM",
  "phaseObserved",
];

export type MissingItem = keyof SurveyFields | "shadowNotes" | "geoPhoto" | "shadowPhoto";

export function missingSurveyItems(draft: SurveyDraft, photos: SurveyPhotos): MissingItem[] {
  const missing: MissingItem[] = [];
  for (const key of REQUIRED_FIELDS) {
    const v = draft[key];
    if (v === null || v === undefined || (typeof v === "number" && !Number.isFinite(v))) missing.push(key);
    else if ((key === "roofLengthM" || key === "roofWidthM") && typeof v === "number" && v <= 0) missing.push(key);
  }
  // If the south side is NOT shadow-free, the worker must say what casts the shadow.
  if (draft.southShadowFree === false && !draft.shadowNotes?.trim()) missing.push("shadowNotes");
  if (photos.shadow < 1) missing.push("shadowPhoto");
  if (photos.roofGeo < 1) missing.push("geoPhoto");
  return missing;
}

export function roofAreaSqm(lengthM: number | null | undefined, widthM: number | null | undefined): number | null {
  if (!lengthM || !widthM || lengthM <= 0 || widthM <= 0) return null;
  return Math.round(lengthM * widthM * 100) / 100;
}
