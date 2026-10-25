import { istDateParts } from "@/lib/format";

/** Indian financial year (April–March) of a date, in IST: "2026-2027". */
export function fiscalYearOf(date: Date): string {
  const { month, year } = istDateParts(date);
  const start = month >= 4 ? year : year - 1;
  return `${start}-${start + 1}`;
}

/** "0241/RPR/10/2026-2027" */
export function formatRefNo(serial: number, cityCode: string, date: Date): string {
  if (!Number.isInteger(serial) || serial < 1) throw new RangeError("Serial must be a positive integer");
  if (!/^[A-Z]{3}$/.test(cityCode)) throw new RangeError(`Invalid city code: ${cityCode}`);
  const { month } = istDateParts(date);
  return `${String(serial).padStart(4, "0")}/${cityCode}/${String(month).padStart(2, "0")}/${fiscalYearOf(date)}`;
}

const REF_RE = /^(\d{4,})\/([A-Z]{3})\/(0[1-9]|1[0-2])\/(\d{4})-(\d{4})$/;

export function parseRefNo(ref: string): { serial: number; cityCode: string; month: number; fiscalYear: string } | null {
  const m = ref.match(REF_RE);
  if (!m || Number(m[5]) !== Number(m[4]) + 1) return null;
  return { serial: Number(m[1]), cityCode: m[2], month: Number(m[3]), fiscalYear: `${m[4]}-${m[5]}` };
}
