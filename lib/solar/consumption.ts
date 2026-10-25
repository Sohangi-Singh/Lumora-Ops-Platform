import { MONTH_KEY_RE, type MonthlyUnits } from "./types";

const SOURCE_PRIORITY: Record<NonNullable<MonthlyUnits["source"]>, number> = {
  MANUAL: 3,
  BILL: 2,
  HISTORY: 1,
};

/** "2026-03" → 2026*12+2, so consecutive months differ by exactly 1. */
export function monthIndex(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return y * 12 + (m - 1);
}

export function monthFromIndex(index: number): string {
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** Normalise "2026/03", "03/2026", "Mar-2026" style keys to "YYYY-MM"; null if unparseable. */
export function normalizeMonthKey(raw: string): string | null {
  const s = raw.trim();
  if (MONTH_KEY_RE.test(s)) return s;
  let m = s.match(/^(\d{4})[/.\-](\d{1,2})$/);
  if (m) return toKey(Number(m[1]), Number(m[2]));
  m = s.match(/^(\d{1,2})[/.\-](\d{4})$/);
  if (m) return toKey(Number(m[2]), Number(m[1]));
  m = s.match(/^([A-Za-z]{3,9})[\s\-/,]*(\d{2,4})$/);
  if (m) {
    const idx = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(
      m[1].slice(0, 3).toLowerCase(),
    );
    if (idx >= 0) {
      const year = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
      return toKey(year, idx + 1);
    }
  }
  return null;
}

function toKey(year: number, month: number): string | null {
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Merge readings from several sources (bill table, CSPDCL app history, manual
 * edits). One entry per month; MANUAL beats BILL beats HISTORY. Sorted newest first.
 */
export function mergeConsumption(...lists: MonthlyUnits[][]): MonthlyUnits[] {
  const byMonth = new Map<string, MonthlyUnits>();
  for (const list of lists) {
    for (const entry of list) {
      const month = normalizeMonthKey(entry.month);
      if (!month || !Number.isFinite(entry.units)) continue;
      const candidate = { ...entry, month };
      const existing = byMonth.get(month);
      const pri = (e: MonthlyUnits) => SOURCE_PRIORITY[e.source ?? "BILL"];
      if (!existing || pri(candidate) > pri(existing)) byMonth.set(month, candidate);
    }
  }
  return [...byMonth.values()].sort((a, b) => monthIndex(b.month) - monthIndex(a.month));
}

/** Months missing between the oldest and newest reading. */
export function findMonthGaps(months: MonthlyUnits[]): string[] {
  if (months.length < 2) return [];
  const idx = months.map((m) => monthIndex(m.month)).sort((a, b) => a - b);
  const present = new Set(idx);
  const gaps: string[] = [];
  for (let i = idx[0]; i <= idx[idx.length - 1]; i++) {
    if (!present.has(i)) gaps.push(monthFromIndex(i));
  }
  return gaps;
}
