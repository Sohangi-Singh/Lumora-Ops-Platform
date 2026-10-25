import { normalizeMonthKey } from "@/lib/solar/consumption";
import type { ExtractedBill } from "./schema";

/**
 * Deterministic parser for the text layer of a CSPDCL LT bill PDF.
 *
 * The Hindi labels extract garbled (broken Devanagari ligatures), but digits
 * and Latin text survive, so we anchor on value *shapes* rather than labels:
 * the 10-digit service number, "4000.00W", the "YYYY/MM reading units" rows
 * of the previous-6-readings table, LV tariff codes, etc. It never throws;
 * missing fields are null and the cross-checks decide how much to trust it.
 */
export function parseCspdclText(text: string): ExtractedBill & { fieldsFound: number } {
  const t = text.replace(/­/g, "").replace(/[ \t]+/g, " ");

  const serviceNo = t.match(/(?:^|\n)\s*1\.\s[^\n]*?\b(\d{10})\b/)?.[1] ?? t.match(/\b(1\d{9})\b/)?.[1] ?? null;

  const billPeriod = t.match(/\b(20\d{2})\/(0[1-9]|1[0-2])\s+\d{9,}/);
  const billMonth = billPeriod ? `${billPeriod[1]}-${billPeriod[2]}` : null;

  let sanctionedLoadW: number | null = null;
  const loadW = t.match(/\b(\d{2,6}(?:\.\d+)?)\s?W\b/);
  const loadKw = t.match(/\b(\d{1,3}(?:\.\d+)?)\s?KW\b/i);
  if (loadW) sanctionedLoadW = Math.round(Number(loadW[1]));
  else if (loadKw) sanctionedLoadW = Math.round(Number(loadKw[1]) * 1000);

  // Previous-6-readings table: "<marker>. 2026/03 180162 1152"
  const history: { month: string; reading: number; units: number }[] = [];
  for (const m of t.matchAll(/(?:^|\n)\s*\S{1,3}\.\s+(20\d{2}\/\d{2})\s+(\d{3,})\s+(\d{1,6})\b/g)) {
    const month = normalizeMonthKey(m[1]);
    if (month) history.push({ month, reading: Number(m[2]), units: Number(m[3]) });
  }
  history.sort((a, b) => (a.month < b.month ? 1 : -1));

  const currentReading = loadW ? Number(t.slice(loadW.index! + loadW[0].length).match(/^\s+(\d{3,})/)?.[1] ?? NaN) : NaN;
  const previousReading = history[0]?.reading ?? null;
  const mf = Number(t.match(/\b(\d\.\d{4})\b/)?.[1] ?? 1);
  let billedUnits: number | null = null;
  if (Number.isFinite(currentReading) && previousReading !== null) {
    const diff = Math.round((currentReading - previousReading) * (Number.isFinite(mf) && mf > 0 ? mf : 1));
    // Only trust the difference if the same figure is printed on the bill.
    if (diff > 0 && new RegExp(`\\b${diff}\\b`).test(t)) billedUnits = diff;
  }

  const monthlyConsumption = history.map((h) => ({ month: h.month, units: h.units }));
  if (billMonth && billedUnits !== null) monthlyConsumption.unshift({ month: billMonth, units: billedUnits });

  // Net amount due: pdf.js emits the "by due date / with surcharge" pair twice.
  const pair = t.match(/\b(\d{2,7}\.\d{2})\s*\n\s*(\d{2,7}\.\d{2})\s*\n\s*\1\s*\n\s*\2\b/);
  const netBillAmount = pair ? Number(pair[1]) : null;

  const nameMatch = t.match(/(?:^|\n)\s*5\.[^\n]*?\b((?:SHRI|SMT|KU|MR|MRS|MS|M\/S)\.?\s+[A-Z][A-Z .]+?)\s*\.?\s*(?:\n|$)/);
  const consumerName = nameMatch ? nameMatch[1].replace(/\s+/g, " ").trim() : null;

  let billAddress: string | null = null;
  const addr = t.match(/(?:^|\n)\s*6\.[^\n:]*:\s*([^\n]+)\n([^\n]+)\n([^\n]+)/);
  if (addr) {
    const lines = [addr[1], addr[2], addr[3]].filter((l) => /[A-Z0-9]/.test(l) && !/^\s*\d{1,2}\./.test(l));
    billAddress = lines.join(", ").replace(/\s+/g, " ").trim() || null;
  }

  const tariffCategory = t.match(/\b(L[VT]\d[A-Z0-9]{3,})\b/)?.[1] ?? null;
  const purpose = t.match(/\b((?:Residential|Domestic|Commercial|Non[- ]Domestic|Agricultur\w*|Industrial)\s+Connection)\b/i)?.[1] ?? null;
  const exportMatch = t.match(/Export Consumption:\s*(\d+(?:\.\d+)?)/i);

  const result: ExtractedBill = {
    documentKind: "CSPDCL_BILL",
    serviceNo,
    consumerName,
    billAddress,
    purpose,
    tariffCategory,
    sanctionedLoadW,
    connectedLoadKw: null,
    phase: null,
    billMonth,
    currentReading: Number.isFinite(currentReading) ? currentReading : null,
    previousReading,
    multiplyingFactor: Number.isFinite(mf) ? mf : null,
    billedUnits,
    netBillAmount,
    existingSolarExport: exportMatch ? Number(exportMatch[1]) : null,
    monthlyConsumption,
    confidence: null,
    notes: null,
  };
  const keyFields = [serviceNo, billMonth, sanctionedLoadW, result.currentReading, previousReading, billedUnits, consumerName, tariffCategory];
  const fieldsFound = keyFields.filter((v) => v !== null && v !== undefined).length + (history.length >= 3 ? 1 : 0);
  return { ...result, fieldsFound };
}
