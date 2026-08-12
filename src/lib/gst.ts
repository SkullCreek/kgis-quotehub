/**
 * Tax calculation engine.
 *
 * Handles two situations from one code path:
 *
 *  DOMESTIC — Indian GST. Place of supply decides the split: same state
 *  as us gives CGST + SGST at half the slab each, a different state
 *  gives IGST at the full slab.
 *
 *  EXPORT — supplies out of India are zero-rated under GST, so no GST
 *  is charged at all. Instead any taxes the destination country levies
 *  are entered as named custom rows (VAT, customs duty, levies), each a
 *  percentage of the taxable value.
 *
 * Custom tax rows are available on domestic documents too, for anything
 * GST does not cover.
 *
 * Other rules:
 *
 *  - Discounts reduce the taxable value, they are never applied after
 *    tax. A per-line discount comes off that line; an order-level
 *    discount is spread across lines in proportion to their value so
 *    each line keeps its own slab.
 *  - Freight is treated as part of a composite supply and apportioned
 *    the same way, inheriting each line's slab.
 *  - GST is computed per line and then summed, never on the grand
 *    total. Mixing slabs any other way produces a figure that will not
 *    reconcile with GSTR-1.
 *  - For currencies that round to whole units (INR), the total is
 *    rounded to the nearest whole unit and the difference is shown as
 *    an explicit round-off line. Export currencies keep their cents.
 *
 * Everything is in integer minor units. See ./money.ts.
 */

import { percentOf, roundHalfAwayFromZero, toMinor } from "./money";
import { getCurrency, minorPerMajor, type Currency } from "./currency";

export type TaxMode = "cgst_sgst" | "igst" | "export";

export interface CustomTax {
  /** Printed as-is on the document, e.g. "VAT" or "Customs Duty". */
  name: string;
  /** Plain percentage, e.g. 5 for 5%. */
  percent: number;
}

export interface ComputedCustomTax extends CustomTax {
  /** Minor units. */
  amount: number;
}

export interface LineInput {
  name: string;
  description?: string | null;
  remark?: string | null;
  section?: string | null;
  hsn?: string | null;
  unit?: string;
  /** May be fractional, e.g. 2.5 kg. */
  quantity: number;
  /** Rate per unit in major units, exclusive of tax. */
  rate: number;
  /** Per-line discount percentage, 0-100. */
  discountPercent?: number;
  /** GST slab percentage, e.g. 18. Ignored in export mode. */
  gstRate: number;
}

export interface DocumentInput {
  lines: LineInput[];
  /** Order-level discount percentage on the post-line-discount subtotal. */
  discountPercent?: number;
  /** Freight / packing in major units, added before tax. */
  shipping?: number;
  taxMode: TaxMode;
  customTaxes?: CustomTax[];
  currency?: Currency;
}

export interface ComputedLine {
  name: string;
  description?: string | null;
  remark?: string | null;
  section?: string | null;
  hsn?: string | null;
  unit: string;
  quantity: number;
  gstRate: number;
  discountPercent: number;
  /** Minor units. */
  rate: number;
  lineSubtotal: number;
  lineDiscount: number;
  /** After line discount, order-discount share and freight share. */
  lineTaxable: number;
  /** Total GST on this line, whatever the split. Zero when exporting. */
  lineTax: number;
  lineCgst: number;
  lineSgst: number;
  lineIgst: number;
  lineTotal: number;
}

export interface HsnSummaryRow {
  hsn: string;
  gstRate: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
}

export interface ComputedDocument {
  lines: ComputedLine[];
  taxMode: TaxMode;
  subtotal: number;
  discountAmount: number;
  shipping: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  /** Total of the GST components only. */
  gstTotal: number;
  customTaxes: ComputedCustomTax[];
  /** Total of the custom tax rows only. */
  customTaxTotal: number;
  /** GST plus custom taxes. */
  totalTax: number;
  roundOff: number;
  total: number;
  hsnSummary: HsnSummaryRow[];
}

/**
 * CGST+SGST within the state, IGST across states, and nothing at all
 * when the customer is outside India.
 */
export function resolveTaxMode(
  supplierStateCode: string,
  customerStateCode: string | null | undefined,
  customerCountry?: string | null,
): TaxMode {
  if (isExport(customerCountry)) return "export";

  const supplier = (supplierStateCode ?? "").trim();
  const customer = (customerStateCode ?? "").trim();
  // With no customer state on record, assume a local sale rather than
  // silently charging IGST: it is the commoner case and the easier
  // mistake to spot on the printed document.
  if (!customer) return "cgst_sgst";
  return supplier === customer ? "cgst_sgst" : "igst";
}

/** Anything with a country set that is not India counts as an export. */
export function isExport(country: string | null | undefined): boolean {
  const c = (country ?? "").trim().toLowerCase();
  if (!c) return false;
  return c !== "india" && c !== "in" && c !== "ind";
}

/**
 * Distributes `amount` across `weights` proportionally, guaranteeing the
 * parts sum exactly back to `amount`. Any rounding remainder lands on
 * the largest weight, where it is least visible.
 */
function apportion(amount: number, weights: number[]): number[] {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (amount === 0 || weights.length === 0) return weights.map(() => 0);

  if (totalWeight === 0) {
    const base = Math.trunc(amount / weights.length);
    const parts = weights.map(() => base);
    parts[0] += amount - base * weights.length;
    return parts;
  }

  const parts = weights.map((w) =>
    roundHalfAwayFromZero((amount * w) / totalWeight),
  );
  const drift = amount - parts.reduce((a, b) => a + b, 0);
  if (drift !== 0) {
    let largest = 0;
    for (let i = 1; i < weights.length; i++) {
      if (weights[i] > weights[largest]) largest = i;
    }
    parts[largest] += drift;
  }
  return parts;
}

export function computeDocument(input: DocumentInput): ComputedDocument {
  const { taxMode } = input;
  const currency = input.currency ?? getCurrency("INR");
  const orderDiscountPercent = clampPercent(input.discountPercent ?? 0);
  const shippingMinor = toMinor(input.shipping ?? 0, currency);

  // --- Step 1: per-line subtotal and line-level discount --------------
  const staged = input.lines.map((line) => {
    const rateMinor = toMinor(line.rate, currency);
    const qty = Number.isFinite(line.quantity) ? line.quantity : 0;
    const lineSubtotal = roundHalfAwayFromZero(rateMinor * qty);
    const discountPercent = clampPercent(line.discountPercent ?? 0);
    const lineDiscount = percentOf(lineSubtotal, discountPercent);
    return {
      line,
      rateMinor,
      qty,
      lineSubtotal,
      discountPercent,
      lineDiscount,
      afterLineDiscount: lineSubtotal - lineDiscount,
    };
  });

  const subtotal = staged.reduce((a, s) => a + s.lineSubtotal, 0);
  const lineDiscountTotal = staged.reduce((a, s) => a + s.lineDiscount, 0);
  const afterLineDiscounts = staged.reduce((a, s) => a + s.afterLineDiscount, 0);

  // --- Step 2: spread the order-level discount and freight ------------
  const orderDiscountTotal = percentOf(afterLineDiscounts, orderDiscountPercent);
  const weights = staged.map((s) => s.afterLineDiscount);
  const discountShares = apportion(orderDiscountTotal, weights);
  const shippingShares = apportion(shippingMinor, weights);

  // --- Step 3: taxable value and GST, per line ------------------------
  const lines: ComputedLine[] = staged.map((s, i) => {
    const lineTaxable = s.afterLineDiscount - discountShares[i] + shippingShares[i];
    const gstRate =
      taxMode === "export"
        ? 0
        : Number.isFinite(s.line.gstRate)
          ? s.line.gstRate
          : 0;
    const lineTax = percentOf(lineTaxable, gstRate);

    let lineCgst = 0;
    let lineSgst = 0;
    let lineIgst = 0;
    if (taxMode === "igst") {
      lineIgst = lineTax;
    } else if (taxMode === "cgst_sgst") {
      // Halve the tax, not the rate, then give any odd minor unit to
      // CGST so CGST + SGST always equals the line's total tax.
      lineSgst = Math.trunc(lineTax / 2);
      lineCgst = lineTax - lineSgst;
    }

    return {
      name: s.line.name,
      description: s.line.description ?? null,
      remark: s.line.remark ?? null,
      section: s.line.section ?? null,
      hsn: s.line.hsn ?? null,
      unit: s.line.unit || "Nos",
      quantity: s.qty,
      gstRate,
      discountPercent: s.discountPercent,
      rate: s.rateMinor,
      lineSubtotal: s.lineSubtotal,
      lineDiscount: s.lineDiscount,
      lineTaxable,
      lineTax,
      lineCgst,
      lineSgst,
      lineIgst,
      lineTotal: lineTaxable + lineTax,
    };
  });

  // --- Step 4: roll up, then apply custom taxes -----------------------
  const taxableValue = lines.reduce((a, l) => a + l.lineTaxable, 0);
  const cgst = lines.reduce((a, l) => a + l.lineCgst, 0);
  const sgst = lines.reduce((a, l) => a + l.lineSgst, 0);
  const igst = lines.reduce((a, l) => a + l.lineIgst, 0);
  const gstTotal = cgst + sgst + igst;

  // Each custom tax is a percentage of the taxable value, charged
  // independently of the others. None of them compound.
  const customTaxes: ComputedCustomTax[] = (input.customTaxes ?? [])
    .filter((t) => t.name.trim() !== "")
    .map((t) => {
      const percent = clampPercent(t.percent);
      return {
        name: t.name.trim(),
        percent,
        amount: percentOf(taxableValue, percent),
      };
    });
  const customTaxTotal = customTaxes.reduce((a, t) => a + t.amount, 0);

  const totalTax = gstTotal + customTaxTotal;
  const exactTotal = taxableValue + totalTax;

  let total = exactTotal;
  let roundOff = 0;
  if (currency.roundToWhole) {
    const scale = minorPerMajor(currency);
    total = roundHalfAwayFromZero(exactTotal / scale) * scale;
    roundOff = total - exactTotal;
  }

  return {
    lines,
    taxMode,
    subtotal,
    discountAmount: lineDiscountTotal + orderDiscountTotal,
    shipping: shippingMinor,
    taxableValue,
    cgst,
    sgst,
    igst,
    gstTotal,
    customTaxes,
    customTaxTotal,
    totalTax,
    roundOff,
    total,
    hsnSummary: buildHsnSummary(lines),
  };
}

/** Groups lines by HSN code and slab, as the printed GST summary requires. */
function buildHsnSummary(lines: ComputedLine[]): HsnSummaryRow[] {
  const map = new Map<string, HsnSummaryRow>();
  for (const l of lines) {
    const hsn = (l.hsn ?? "").trim() || "—";
    const key = `${hsn}::${l.gstRate}`;
    const existing = map.get(key);
    if (existing) {
      existing.taxable += l.lineTaxable;
      existing.cgst += l.lineCgst;
      existing.sgst += l.lineSgst;
      existing.igst += l.lineIgst;
    } else {
      map.set(key, {
        hsn,
        gstRate: l.gstRate,
        taxable: l.lineTaxable,
        cgst: l.lineCgst,
        sgst: l.lineSgst,
        igst: l.lineIgst,
      });
    }
  }
  return [...map.values()].sort(
    (a, b) => a.gstRate - b.gstRate || a.hsn.localeCompare(b.hsn),
  );
}

function clampPercent(p: number): number {
  if (!Number.isFinite(p)) return 0;
  return Math.min(100, Math.max(0, p));
}

/** The GST state codes, used for the state dropdown and IGST detection. */
export const STATE_CODES: { code: string; name: string }[] = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman and Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
  { code: "97", name: "Other Territory" },
];

export const GST_SLABS = [0, 0.25, 3, 5, 12, 18, 28];

/** Loose GSTIN shape check: 2 digit state, 10 char PAN, entity, Z, checksum. */
export const GSTIN_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function isValidGstin(gstin: string): boolean {
  return GSTIN_REGEX.test(gstin.trim().toUpperCase());
}

/** Pulls the state code out of a GSTIN, so customers rarely need to pick one. */
export function stateCodeFromGstin(gstin: string): string | null {
  const clean = gstin.trim().toUpperCase();
  if (clean.length < 2) return null;
  const code = clean.slice(0, 2);
  return STATE_CODES.some((s) => s.code === code) ? code : null;
}
