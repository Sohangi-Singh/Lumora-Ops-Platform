import { describe, expect, it } from "vitest";
import { missingSurveyItems, roofAreaSqm, type SurveyDraft } from "@/lib/survey/requirements";

const COMPLETE: SurveyDraft = {
  roofLengthM: 8,
  roofWidthM: 6,
  roofType: "RCC",
  buildingHeightM: 7,
  southShadowFree: true,
  shadowNotes: null,
  roofToMeterVerticalM: 7,
  roofToMeterHorizontalM: 5,
  panelToInverterVerticalM: 3,
  panelToInverterHorizontalM: 6,
  inverterToMeterM: 4,
  phaseObserved: "THREE",
  notes: null,
};

describe("survey requirements", () => {
  it("nothing missing for a complete survey with photos", () => {
    expect(missingSurveyItems(COMPLETE, { roofGeo: 1, shadow: 1 })).toEqual([]);
  });

  it("lists every missing field and photo for an empty draft", () => {
    const missing = missingSurveyItems({}, { roofGeo: 0, shadow: 0 });
    expect(missing).toContain("roofLengthM");
    expect(missing).toContain("inverterToMeterM");
    expect(missing).toContain("geoPhoto");
    expect(missing).toContain("shadowPhoto");
    expect(missing).not.toContain("shadowNotes");
  });

  it("requires shadow notes when the south side is shaded", () => {
    expect(missingSurveyItems({ ...COMPLETE, southShadowFree: false }, { roofGeo: 1, shadow: 1 })).toEqual(["shadowNotes"]);
    expect(missingSurveyItems({ ...COMPLETE, southShadowFree: false, shadowNotes: "Neem tree on south-west" }, { roofGeo: 1, shadow: 1 })).toEqual([]);
  });

  it("treats zero roof dimensions as missing but zero distances as valid", () => {
    const m = missingSurveyItems({ ...COMPLETE, roofLengthM: 0, roofToMeterHorizontalM: 0 }, { roofGeo: 1, shadow: 1 });
    expect(m).toEqual(["roofLengthM"]);
  });

  it("computes roof area", () => {
    expect(roofAreaSqm(8, 6.25)).toBe(50);
    expect(roofAreaSqm(null, 6)).toBeNull();
  });
});
