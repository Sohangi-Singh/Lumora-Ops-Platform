import { z } from "zod";

/**
 * Every business constant lives here and is editable in Admin → Settings.
 * Defaults are taken from Lumora's sample quotation and RTS sizing sheet.
 */
export const SettingsSchema = z.object({
  sizing: z.object({
    panelWattage: z.number().int().min(100).max(1000).default(600),
    unitsPerKwPerDay: z.number().positive().max(10).default(5),
    sqmPerKwpMin: z.number().positive().default(7),
    /** Conservative figure used for the roof-area cap */
    sqmPerKwp: z.number().positive().default(10),
    roundingStepKw: z.number().positive().default(1),
    minSystemKw: z.number().positive().default(1),
    maxMonthsForAverage: z.number().int().min(3).max(24).default(12),
    minMonthsForAverage: z.number().int().min(1).max(12).default(3),
  }),
  gst: z.object({
    goodsSharePct: z.number().min(0).max(100).default(70),
    goodsRatePct: z.number().min(0).max(100).default(5),
    servicesSharePct: z.number().min(0).max(100).default(30),
    servicesRatePct: z.number().min(0).max(100).default(18),
  }),
  subsidy: z.object({
    /** PM Surya Ghar central financial assistance */
    centralPerKwFirst2: z.number().int().nonnegative().default(30000),
    centralThirdKw: z.number().int().nonnegative().default(18000),
    centralCap: z.number().int().nonnegative().default(78000),
    /** Chhattisgarh state top-up (flat, configurable) */
    stateAmount: z.number().int().nonnegative().default(30000),
  }),
  economics: z.object({
    exportTariffPerUnit: z.number().nonnegative().default(1.95),
    /** Used when the bill doesn't give an effective ₹/unit */
    defaultTariffPerUnit: z.number().positive().default(6.5),
    panelDegradationPctPerYear: z.number().min(0).max(5).default(0.5),
    analysisYears: z.number().int().min(1).max(40).default(25),
  }),
  payment: z.object({
    advancePct: z.number().min(0).max(100).default(90),
    balancePct: z.number().min(0).max(100).default(10),
  }),
  quote: z.object({
    validityDays: z.number().int().min(1).max(90).default(6),
    completionDays: z.number().int().min(1).max(365).default(40),
    earthingCount: z.number().int().min(0).default(3),
    dcCableSlackPct: z.number().min(0).max(100).default(15),
    /** Basic per-Wp formula; see computeBasicPerWp() */
    basicPerWpMethod: z.enum(["SPLIT_OF_INCLUSIVE", "BLENDED_RATE"]).default("SPLIT_OF_INCLUSIVE"),
    /** Append a customer-friendly savings page after the formal proposal */
    includeSavingsPage: z.boolean().default(false),
  }),
  terms: z.object({
    paymentTerms: z.array(z.string()).default([
      "90% of Contract Value- Advance along with Purchase Order (PO) or confirmation",
      "10% Contract Value at the time of file submission for Synchronization of the Plant i.e. “Net Metering”",
    ]),
    generalTerms: z.array(z.string()).default([
      "Products Warranties will be given by the Product Manufacturers i.e. “Manufacturer’s Warranty” and will be varied as per brand, model & availability.",
      "AMC for **5 years** is in the Scope of “Lumora Solar”",
      "Net Metering and Synchronization is in the Scope of “Lumora Solar”",
      "Solar Panels washing/cleaning will be in the scope of the Client",
      "Shadow Free Area (south facing) will be provided by the Client – 7 to 10 Sq m per kWp",
      "If any material required over and above the list, extra charges to be paid by the Client",
      "Project will be completed within **40 Days from the date of PO and/or Advance**",
      "Subsidy will come directly into client’s bank account by Central and State Government as applicable as on date.",
    ]),
  }),
  bank: z.object({
    accountName: z.string().default("Lumora Solar Private Limited"),
    bankName: z.string().default("State Bank of India (SBI)"),
    accountNumber: z.string().default("44679 445689"),
    accountType: z.string().default("Current Bank Account"),
    ifsc: z.string().default("SBIN0000461"),
  }),
  signatory: z.object({
    name: z.string().default("Deepak Singh"),
    designation: z.string().default("Managing Director"),
    phone: z.string().default("99810 36737"),
    email: z.string().default("deepaksingh@lumorasolar.org"),
  }),
  company: z.object({
    supportPhone: z.string().default("+91 99810 36737"),
    supportEmail: z.string().default("deepaksingh@lumorasolar.org"),
  }),
  cityCodes: z
    .array(z.object({ code: z.string().regex(/^[A-Z]{3}$/), name: z.string(), state: z.string() }))
    .default([
      { code: "RPR", name: "Raipur", state: "Chhattisgarh" },
      { code: "DEL", name: "Delhi NCR", state: "Delhi" },
    ]),
  /** Safe area inside the letterhead, in PDF points (A4 = 595 × 842) */
  letterhead: z.object({
    marginTop: z.number().min(0).default(130),
    marginBottom: z.number().min(0).default(122),
    marginLeft: z.number().min(0).default(56),
    marginRight: z.number().min(0).default(56),
  }),
  sla: z.object({
    surveyDueDays: z.number().int().min(1).default(3),
    quoteApprovalHours: z.number().int().min(1).default(24),
    slaRiskDaysRemaining: z.number().int().min(0).default(7),
  }),
});

export type Settings = z.infer<typeof SettingsSchema>;

/** Fills every missing key with its default — tolerant of older stored rows. */
export function parseSettings(data: unknown): Settings {
  const raw = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const withSections = Object.fromEntries(
    Object.keys(SettingsSchema.shape).map((k) => [k, raw[k] ?? (k === "cityCodes" ? undefined : {})]),
  );
  return SettingsSchema.parse(withSections);
}

export const DEFAULT_SETTINGS: Settings = parseSettings({});
