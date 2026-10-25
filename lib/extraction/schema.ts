import { z } from "zod";

const nullableNumber = z.preprocess((v) => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "string") {
    const n = Number(v.replace(/[,\s₹]/g, "").replace(/W$/i, ""));
    return Number.isFinite(n) ? n : null;
  }
  return v;
}, z.number().finite().nullable());

const nullableString = z.preprocess(
  (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null),
  z.string().nullable(),
);

/** What we ask Claude to return (and what the text parser produces). */
export const ExtractedBillSchema = z.object({
  documentKind: z.enum(["CSPDCL_BILL", "CONSUMPTION_HISTORY", "OTHER_BILL", "NOT_A_BILL"]).default("CSPDCL_BILL"),
  serviceNo: nullableString.default(null),
  consumerName: nullableString.default(null),
  billAddress: nullableString.default(null),
  purpose: nullableString.default(null),
  tariffCategory: nullableString.default(null),
  sanctionedLoadW: nullableNumber.default(null),
  connectedLoadKw: nullableNumber.default(null),
  phase: z.enum(["SINGLE", "THREE"]).nullable().default(null),
  billMonth: nullableString.default(null),
  currentReading: nullableNumber.default(null),
  previousReading: nullableNumber.default(null),
  multiplyingFactor: nullableNumber.default(null),
  billedUnits: nullableNumber.default(null),
  netBillAmount: nullableNumber.default(null),
  existingSolarExport: nullableNumber.default(null),
  monthlyConsumption: z
    .array(z.object({ month: z.string(), units: nullableNumber }))
    .default([])
    .transform((rows) => rows.filter((r): r is { month: string; units: number } => r.units !== null)),
  confidence: z.number().min(0).max(1).nullable().default(null),
  notes: nullableString.default(null),
});

export type ExtractedBill = z.infer<typeof ExtractedBillSchema>;

const num = (description: string) => ({ type: ["number", "null"], description });
const str = (description: string) => ({ type: ["string", "null"], description });

/**
 * JSON schema for Claude's structured output (output_config.format). Every
 * field is required-but-nullable with no extra keys, as structured outputs
 * expect; ExtractedBillSchema then re-validates and coerces the result.
 */
export const EXTRACTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "documentKind",
    "serviceNo",
    "consumerName",
    "billAddress",
    "purpose",
    "tariffCategory",
    "sanctionedLoadW",
    "connectedLoadKw",
    "phase",
    "billMonth",
    "currentReading",
    "previousReading",
    "multiplyingFactor",
    "billedUnits",
    "netBillAmount",
    "existingSolarExport",
    "monthlyConsumption",
    "confidence",
    "notes",
  ],
  properties: {
    documentKind: {
      type: "string",
      enum: ["CSPDCL_BILL", "CONSUMPTION_HISTORY", "OTHER_BILL", "NOT_A_BILL"],
      description:
        "CSPDCL_BILL for a CSPDCL electricity bill; CONSUMPTION_HISTORY for a screenshot of the CSPDCL app's consumption history.",
    },
    serviceNo: str("सर्विस क्रमांक / service number, digits only"),
    consumerName: str("उपभोक्ता का नाम as printed (Latin script)"),
    billAddress: str("पता, single line"),
    purpose: str("प्रयोजन, e.g. 'Residential Connection'"),
    tariffCategory: str("टैरिफ श्रेणी, e.g. 'LV1DL1SR25'"),
    sanctionedLoadW: num("अनुबंध भार / contract (sanctioned) load in WATTS: '4000.00W' → 4000, '4 KW' → 4000"),
    connectedLoadKw: num("Connected load in kW only if printed separately"),
    phase: { type: ["string", "null"], enum: ["SINGLE", "THREE", null], description: "विद्युत फेज; null if blank" },
    billMonth: str("बिल अवधि as YYYY-MM"),
    currentReading: num("वर्तमान रीडिंग"),
    previousReading: num("पिछली रीडिंग"),
    multiplyingFactor: num("गुणांक (usually 1)"),
    billedUnits: num("विद्युत खपत / कुल खपत for the bill month, in units (kWh)"),
    netBillAmount: num("नियत तिथि तक शुद्ध देयक राशि (net amount payable by the due date), rupees"),
    existingSolarExport: num("Solar Roof Top export consumption units; 0 if printed as 0"),
    monthlyConsumption: {
      type: "array",
      description:
        "Every month of consumption visible: the bill month itself (billedUnits) plus each row of 'विगत 6 रीडिंग का ब्यौरा', or every bar/row of the app history. Month as YYYY-MM.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["month", "units"],
        properties: { month: { type: "string" }, units: { type: ["number", "null"] } },
      },
    },
    confidence: { type: "number", description: "0–1: how sure you are that every non-null field is read correctly" },
    notes: str("Anything unclear, cut off or unreadable"),
  },
} as const;
