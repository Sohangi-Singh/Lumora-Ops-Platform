const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

/** 0–99 → "Fifty-One" */
function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = TENS[Math.floor(n / 10)];
  const o = ONES[n % 10];
  return o ? `${t}-${o}` : t;
}

/** 0–999 */
function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} Hundred`);
  if (rest) parts.push(twoDigits(rest));
  return parts.join(" ");
}

/**
 * Indian numbering system in words: 351000 → "Three Lakh Fifty-One Thousand".
 * Handles up to 99,99,99,99,999 (crores repeat above that).
 */
export function numberToIndianWords(value: number): string {
  if (!Number.isFinite(value)) throw new RangeError("Amount must be finite");
  let n = Math.floor(Math.abs(value));
  if (n === 0) return "Zero";

  const crore = Math.floor(n / 1_00_00_000);
  n %= 1_00_00_000;
  const lakh = Math.floor(n / 1_00_000);
  n %= 1_00_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${crore >= 100 ? numberToIndianWords(crore) : twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));
  return (value < 0 ? "Minus " : "") + parts.join(" ");
}

/** Rupee amount as printed on the quote: "Three Lakh Fifty-One Thousand Only". */
export function amountInWords(rupees: number): string {
  const whole = Math.round(rupees);
  return `${numberToIndianWords(whole)} Only`;
}
