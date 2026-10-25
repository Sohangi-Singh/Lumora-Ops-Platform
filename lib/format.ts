/**
 * Formatting helpers shared by UI, PDF and emails. Everything is pinned to
 * Asia/Kolkata so server (UTC on Vercel) and browser render the same dates.
 */
export const IST_TIME_ZONE = "Asia/Kolkata";

const inr0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const inrCurrency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** 351000 → "₹3,51,000" */
export function formatINR(amount: number): string {
  return inrCurrency.format(Math.round(amount));
}

/** 351000 → "3,51,000" (no symbol, as printed on the quote) */
export function formatIndianNumber(amount: number, fractionDigits = 0): string {
  if (fractionDigits === 0) return inr0.format(Math.round(amount));
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}

type DateParts = { day: number; month: number; year: number };

/** Calendar date of an instant as seen in India. */
export function istDateParts(date: Date): DateParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIME_ZONE,
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { day: get("day"), month: get("month"), year: get("year") };
}

/** "19/10/2026" */
export function formatDateDMY(date: Date): string {
  const { day, month, year } = istDateParts(date);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function ordinalSuffix(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

/** "25th October 2026" (quote validity line) */
export function formatOrdinalDate(date: Date): string {
  const { day, month, year } = istDateParts(date);
  return `${day}${ordinalSuffix(day)} ${MONTHS[month - 1]} ${year}`;
}

/** Locale-aware medium date for the UI, e.g. "25 Oct 2026" / "25 अक्टू॰ 2026". */
export function formatDate(date: Date | string, locale: string = "en"): string {
  return new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    timeZone: IST_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string, locale: string = "en"): string {
  return new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    timeZone: IST_TIME_ZONE,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

/** "2026-03" → "Mar 2026" */
export function formatMonthKey(key: string, locale: string = "en"): string {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/** Show only the last 4 digits of an Aadhaar number: "XXXX XXXX 1234". */
export function maskAadhaar(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length < 4) return "XXXX XXXX XXXX";
  return `XXXX XXXX ${digits.slice(-4)}`;
}

export function maskPan(value: string | null | undefined): string {
  const v = (value ?? "").toUpperCase().replace(/\s/g, "");
  if (v.length < 4) return "XXXXXXXXXX";
  return `XXXXXX${v.slice(-4)}`;
}

/** Normalise an Indian mobile number to 10 digits (drops +91 / leading 0). */
export function normalizeIndianMobile(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function formatMobile(value: string | null | undefined): string {
  const d = normalizeIndianMobile(value ?? "");
  return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : (value ?? "");
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "2026-10-25T14:30" in IST, for <input type="datetime-local"> defaults. */
export function toIstLocalInput(date: Date): string {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour") === "24" ? "00" : g("hour")}:${g("minute")}`;
}

/** Whole IST calendar days from `from` until `to` (0 = today). */
export function istCalendarDaysUntil(to: Date, from: Date = new Date()): number {
  const a = istDateParts(from);
  const b = istDateParts(to);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000);
}
