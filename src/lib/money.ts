/**
 * Money helpers.
 *
 * All arithmetic is done in a currency's minor unit (paise, cents) as
 * integers, so repeated multiplication and division never accumulates
 * float error. Major units only appear at the edges: parsing input and
 * formatting output.
 *
 * Functions take a Currency because the number of minor units per major
 * unit varies (2 for most, 0 for yen, 3 for dinars), as does grouping.
 */

import {
  getCurrency,
  minorPerMajor,
  type Currency,
  DEFAULT_CURRENCY,
} from "./currency";

/** Major units (number or numeric string) -> integer minor units. */
export function toMinor(
  major: number | string,
  currency: Currency = getCurrency(DEFAULT_CURRENCY),
): number {
  const n = typeof major === "string" ? parseFloat(major) : major;
  if (!isFinite(n)) return 0;
  return roundHalfAwayFromZero(n * minorPerMajor(currency));
}

/** Integer minor units -> the decimal string stored in numeric columns. */
export function minorToDecimalString(
  minor: number,
  currency: Currency = getCurrency(DEFAULT_CURRENCY),
): string {
  return (Math.round(minor) / minorPerMajor(currency)).toFixed(
    currency.decimals,
  );
}

/** A stored decimal string -> integer minor units. */
export function decimalStringToMinor(
  value: string | number | null | undefined,
  currency: Currency = getCurrency(DEFAULT_CURRENCY),
): number {
  if (value === null || value === undefined || value === "") return 0;
  return toMinor(value, currency);
}

/**
 * Rounds to the nearest integer, with .5 going away from zero.
 * JavaScript's Math.round sends -0.5 to -0, which is wrong for money.
 */
export function roundHalfAwayFromZero(n: number): number {
  return n < 0 ? -Math.round(-n) : Math.round(n);
}

/** Applies a percentage to a minor-unit amount, rounded to whole minor units. */
export function percentOf(minor: number, percent: number): number {
  return roundHalfAwayFromZero((minor * percent) / 100);
}

/**
 * Formats a minor-unit amount for display, e.g. 1234567 INR -> "₹12,345.67".
 * Pass `withSymbol: false` inside a table whose header already names the
 * currency.
 */
export function formatMoney(
  minor: number,
  currency: Currency = getCurrency(DEFAULT_CURRENCY),
  withSymbol = true,
): string {
  const major = Math.abs(minor) / minorPerMajor(currency);
  const formatted = new Intl.NumberFormat(currency.locale, {
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  }).format(major);
  const sign = minor < 0 ? "-" : "";
  if (!withSymbol) return `${sign}${formatted}`;
  // Multi-letter codes read better with a space: "AED 1,200.00".
  const gap = /^[A-Z]{2,}$/.test(currency.symbol) ? " " : "";
  return `${sign}${currency.symbol}${gap}${formatted}`;
}

/** Formats a quantity, trimming pointless trailing zeros: 2.500 -> "2.5". */
export function formatQty(qty: number | string): string {
  const n = typeof qty === "string" ? parseFloat(qty) : qty;
  if (!isFinite(n)) return "0";
  return parseFloat(n.toFixed(3)).toString();
}

// ---------------------------------------------------------------------
// Amount in words
// ---------------------------------------------------------------------

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
  "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
  "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];

const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy",
  "Eighty", "Ninety",
];

function twoDigitsToWords(n: number): string {
  if (n < 20) return ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return TENS[tens] + (ones ? " " + ONES[ones] : "");
}

function threeDigitsToWords(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  let out = "";
  if (hundreds) out += ONES[hundreds] + " Hundred";
  if (rest) out += (out ? " " : "") + twoDigitsToWords(rest);
  return out;
}

/** Indian numbering: thousand, lakh, crore. */
function indianToWords(n: number): string {
  if (n === 0) return "Zero";

  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;

  const parts: string[] = [];
  // Crore counts can themselves run past 99, so recurse for huge numbers.
  if (crore) parts.push((crore < 100 ? twoDigitsToWords(crore) : indianToWords(crore)) + " Crore");
  if (lakh) parts.push(twoDigitsToWords(lakh) + " Lakh");
  if (thousand) parts.push(twoDigitsToWords(thousand) + " Thousand");
  if (rest) parts.push(threeDigitsToWords(rest));

  return parts.join(" ");
}

const WESTERN_SCALES = [
  { value: 1_000_000_000_000, name: "Trillion" },
  { value: 1_000_000_000, name: "Billion" },
  { value: 1_000_000, name: "Million" },
  { value: 1_000, name: "Thousand" },
];

/** Western numbering: thousand, million, billion. */
function westernToWords(n: number): string {
  if (n === 0) return "Zero";

  const parts: string[] = [];
  let remaining = n;

  for (const scale of WESTERN_SCALES) {
    const count = Math.floor(remaining / scale.value);
    if (count > 0) {
      parts.push(threeDigitsToWords(count) + " " + scale.name);
      remaining %= scale.value;
    }
  }
  if (remaining > 0) parts.push(threeDigitsToWords(remaining));

  return parts.join(" ");
}

/**
 * "US Dollars Twelve Thousand Three Hundred Forty Five and Sixty Seven
 * Cents Only" — the wording expected on the printed document.
 */
export function amountInWords(
  minor: number,
  currency: Currency = getCurrency(DEFAULT_CURRENCY),
): string {
  const negative = minor < 0;
  const abs = Math.abs(Math.round(minor));
  const scale = minorPerMajor(currency);
  const majorValue = Math.floor(abs / scale);
  const minorValue = abs % scale;

  const toWords = currency.grouping === "indian" ? indianToWords : westernToWords;

  let out = `${currency.majorName} ${toWords(majorValue)}`;
  if (minorValue > 0 && currency.minorName) {
    // Minor units can run to three digits for dinars, so use the full
    // three-digit converter rather than the two-digit one.
    out += ` and ${threeDigitsToWords(minorValue)} ${currency.minorName}`;
  }
  out += " Only";
  return (negative ? "Minus " : "") + out;
}
