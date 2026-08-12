import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDocument, resolveTaxMode, isExport } from "./gst";
import { amountInWords, formatMoney, toMinor } from "./money";
import { getCurrency } from "./currency";

const INR = getCurrency("INR");
const USD = getCurrency("USD");
const JPY = getCurrency("JPY");
const KWD = getCurrency("KWD");

// ---------------------------------------------------------------------
// Domestic GST
// ---------------------------------------------------------------------

test("simple single line at 18% splits into equal CGST and SGST", () => {
  const d = computeDocument({
    taxMode: "cgst_sgst",
    currency: INR,
    lines: [{ name: "Widget", quantity: 10, rate: 100, gstRate: 18 }],
  });
  assert.equal(d.subtotal, 100000);
  assert.equal(d.taxableValue, 100000);
  assert.equal(d.cgst, 9000);
  assert.equal(d.sgst, 9000);
  assert.equal(d.igst, 0);
  assert.equal(d.total, 118000);
  assert.equal(d.roundOff, 0);
});

test("inter-state sale charges the full slab as IGST", () => {
  const d = computeDocument({
    taxMode: "igst",
    currency: INR,
    lines: [{ name: "Widget", quantity: 10, rate: 100, gstRate: 18 }],
  });
  assert.equal(d.igst, 18000);
  assert.equal(d.cgst, 0);
  assert.equal(d.total, 118000);
});

test("CGST plus SGST always equals the total tax even on odd paise", () => {
  const d = computeDocument({
    taxMode: "cgst_sgst",
    currency: INR,
    lines: [{ name: "Odd", quantity: 1, rate: 100.05, gstRate: 18 }],
  });
  assert.equal(d.gstTotal, 1801);
  assert.equal(d.cgst + d.sgst, d.gstTotal);
  assert.equal(d.cgst - d.sgst, 1);
});

test("per-line discount reduces the taxable value, not the total after tax", () => {
  const d = computeDocument({
    taxMode: "cgst_sgst",
    currency: INR,
    lines: [
      { name: "A", quantity: 1, rate: 1000, discountPercent: 10, gstRate: 18 },
    ],
  });
  assert.equal(d.discountAmount, 10000);
  assert.equal(d.taxableValue, 90000);
  assert.equal(d.total, 106200);
});

test("order-level discount is spread across lines and keeps each slab", () => {
  const d = computeDocument({
    taxMode: "cgst_sgst",
    currency: INR,
    discountPercent: 10,
    lines: [
      { name: "A", quantity: 1, rate: 1000, gstRate: 18 },
      { name: "B", quantity: 1, rate: 1000, gstRate: 5 },
    ],
  });
  assert.equal(d.taxableValue, 180000);
  assert.equal(d.lines[0].lineTax, 16200);
  assert.equal(d.lines[1].lineTax, 4500);
  assert.equal(d.gstTotal, 20700);
});

test("apportioned discount always sums back to the exact discount", () => {
  const d = computeDocument({
    taxMode: "igst",
    currency: INR,
    discountPercent: 10,
    lines: [
      { name: "A", quantity: 1, rate: 33.33, gstRate: 18 },
      { name: "B", quantity: 1, rate: 33.33, gstRate: 18 },
      { name: "C", quantity: 1, rate: 33.34, gstRate: 18 },
    ],
  });
  const sumTaxable = d.lines.reduce((a, l) => a + l.lineTaxable, 0);
  assert.equal(sumTaxable, d.taxableValue);
  assert.equal(d.subtotal - d.discountAmount, d.taxableValue);
});

test("freight is apportioned and inherits each line's slab", () => {
  const d = computeDocument({
    taxMode: "igst",
    currency: INR,
    shipping: 100,
    lines: [
      { name: "A", quantity: 1, rate: 500, gstRate: 18 },
      { name: "B", quantity: 1, rate: 500, gstRate: 18 },
    ],
  });
  assert.equal(d.taxableValue, 110000);
  assert.equal(d.igst, 19800);
  assert.equal(d.total, 129800);
});

test("mixed slabs are taxed per line, never on the grand total", () => {
  const d = computeDocument({
    taxMode: "cgst_sgst",
    currency: INR,
    lines: [
      { name: "Food", quantity: 2, rate: 250, gstRate: 5 },
      { name: "Electronics", quantity: 1, rate: 1000, gstRate: 28 },
    ],
  });
  assert.equal(d.lines[0].lineTax, 2500);
  assert.equal(d.lines[1].lineTax, 28000);
  assert.equal(d.gstTotal, 30500);
  assert.equal(d.total, 180500);
});

test("HSN summary groups by code and slab", () => {
  const d = computeDocument({
    taxMode: "cgst_sgst",
    currency: INR,
    lines: [
      { name: "A", hsn: "8471", quantity: 1, rate: 100, gstRate: 18 },
      { name: "B", hsn: "8471", quantity: 1, rate: 100, gstRate: 18 },
      { name: "C", hsn: "9403", quantity: 1, rate: 100, gstRate: 5 },
    ],
  });
  assert.equal(d.hsnSummary.length, 2);
  assert.equal(d.hsnSummary.find((r) => r.hsn === "8471")!.taxable, 20000);
});

test("empty document computes to zero rather than NaN", () => {
  const d = computeDocument({ taxMode: "cgst_sgst", currency: INR, lines: [] });
  assert.equal(d.subtotal, 0);
  assert.equal(d.total, 0);
  assert.equal(d.totalTax, 0);
});

// ---------------------------------------------------------------------
// Export mode
// ---------------------------------------------------------------------

test("export mode charges no GST even when lines carry a slab", () => {
  const d = computeDocument({
    taxMode: "export",
    currency: USD,
    lines: [{ name: "Spare", quantity: 2, rate: 500, gstRate: 18 }],
  });
  assert.equal(d.taxableValue, 100000); // $1000.00
  assert.equal(d.cgst, 0);
  assert.equal(d.sgst, 0);
  assert.equal(d.igst, 0);
  assert.equal(d.gstTotal, 0);
  assert.equal(d.total, 100000);
  // The stored line keeps a zero rate so the printed document cannot
  // claim a slab was applied.
  assert.equal(d.lines[0].gstRate, 0);
});

test("tax mode resolves to export for any country other than India", () => {
  assert.equal(resolveTaxMode("24", "24", "India"), "cgst_sgst");
  assert.equal(resolveTaxMode("24", "27", "India"), "igst");
  assert.equal(resolveTaxMode("24", null, "United Arab Emirates"), "export");
  assert.equal(resolveTaxMode("24", "24", "Kenya"), "export");
  assert.equal(resolveTaxMode("24", "24", null), "cgst_sgst");
  assert.equal(resolveTaxMode("24", "24", ""), "cgst_sgst");
});

test("isExport is case and spacing tolerant", () => {
  assert.equal(isExport("India"), false);
  assert.equal(isExport("  india  "), false);
  assert.equal(isExport("IN"), false);
  assert.equal(isExport("Oman"), true);
  assert.equal(isExport(null), false);
});

// ---------------------------------------------------------------------
// Custom taxes
// ---------------------------------------------------------------------

test("custom taxes are a percentage of the taxable value", () => {
  const d = computeDocument({
    taxMode: "export",
    currency: USD,
    customTaxes: [{ name: "VAT", percent: 5 }],
    lines: [{ name: "Spare", quantity: 1, rate: 1000, gstRate: 0 }],
  });
  assert.equal(d.taxableValue, 100000);
  assert.equal(d.customTaxes.length, 1);
  assert.equal(d.customTaxes[0].amount, 5000); // $50.00
  assert.equal(d.customTaxTotal, 5000);
  assert.equal(d.total, 105000);
});

test("multiple custom taxes do not compound on each other", () => {
  const d = computeDocument({
    taxMode: "export",
    currency: USD,
    customTaxes: [
      { name: "VAT", percent: 5 },
      { name: "Customs Duty", percent: 10 },
    ],
    lines: [{ name: "Spare", quantity: 1, rate: 1000, gstRate: 0 }],
  });
  // Both are charged on 1000, not 1000 then 1050.
  assert.equal(d.customTaxes[0].amount, 5000);
  assert.equal(d.customTaxes[1].amount, 10000);
  assert.equal(d.customTaxTotal, 15000);
  assert.equal(d.total, 115000);
});

test("custom taxes apply after discount and freight, like GST", () => {
  const d = computeDocument({
    taxMode: "export",
    currency: USD,
    discountPercent: 10,
    shipping: 100,
    customTaxes: [{ name: "VAT", percent: 5 }],
    lines: [{ name: "Spare", quantity: 1, rate: 1000, gstRate: 0 }],
  });
  // 1000 - 100 discount + 100 freight = 900 + 100 = 1000 taxable
  assert.equal(d.taxableValue, 100000);
  assert.equal(d.customTaxes[0].amount, 5000);
});

test("unnamed custom taxes are dropped rather than printed blank", () => {
  const d = computeDocument({
    taxMode: "export",
    currency: USD,
    customTaxes: [
      { name: "  ", percent: 5 },
      { name: "VAT", percent: 5 },
    ],
    lines: [{ name: "Spare", quantity: 1, rate: 100, gstRate: 0 }],
  });
  assert.equal(d.customTaxes.length, 1);
  assert.equal(d.customTaxes[0].name, "VAT");
});

test("custom taxes work alongside GST on a domestic document", () => {
  const d = computeDocument({
    taxMode: "cgst_sgst",
    currency: INR,
    customTaxes: [{ name: "Cess", percent: 1 }],
    lines: [{ name: "A", quantity: 1, rate: 1000, gstRate: 18 }],
  });
  assert.equal(d.gstTotal, 18000);
  assert.equal(d.customTaxTotal, 1000);
  assert.equal(d.totalTax, 19000);
  assert.equal(d.total, 119000);
});

// ---------------------------------------------------------------------
// Currency behaviour
// ---------------------------------------------------------------------

test("INR rounds the total to a whole rupee and reports the difference", () => {
  const d = computeDocument({
    taxMode: "igst",
    currency: INR,
    lines: [{ name: "A", quantity: 1, rate: 99.9, gstRate: 18 }],
  });
  assert.equal(d.total, 11800);
  assert.equal(d.roundOff, 11800 - (9990 + 1798));
  assert.equal(d.total % 100, 0);
});

test("USD keeps its cents rather than rounding to whole dollars", () => {
  const d = computeDocument({
    taxMode: "export",
    currency: USD,
    customTaxes: [{ name: "VAT", percent: 5 }],
    lines: [{ name: "A", quantity: 1, rate: 99.9, gstRate: 0 }],
  });
  assert.equal(d.taxableValue, 9990);
  assert.equal(d.customTaxTotal, 500); // 5% of 99.90 = 4.995 -> 5.00
  assert.equal(d.total, 10490);
  assert.equal(d.roundOff, 0);
});

test("zero-decimal currencies treat one yen as one minor unit", () => {
  const d = computeDocument({
    taxMode: "export",
    currency: JPY,
    lines: [{ name: "A", quantity: 3, rate: 1500, gstRate: 0 }],
  });
  assert.equal(d.subtotal, 4500);
  assert.equal(d.total, 4500);
});

test("three-decimal currencies keep all three", () => {
  assert.equal(toMinor(12.345, KWD), 12345);
  assert.equal(formatMoney(12345, KWD), "KWD 12.345");
});

// ---------------------------------------------------------------------
// Formatting and words
// ---------------------------------------------------------------------

test("currency formatting uses the right grouping and symbol", () => {
  assert.equal(formatMoney(12345678, INR), "₹1,23,456.78");
  assert.equal(formatMoney(12345678, USD), "$123,456.78");
  assert.equal(formatMoney(100, INR), "₹1.00");
  assert.equal(formatMoney(150000, JPY), "¥150,000");
});

test("amount in words uses Indian numbering for rupees", () => {
  assert.equal(amountInWords(0, INR), "Rupees Zero Only");
  assert.equal(amountInWords(100, INR), "Rupees One Only");
  assert.equal(
    amountInWords(123456, INR),
    "Rupees One Thousand Two Hundred Thirty Four and Fifty Six Paise Only",
  );
  assert.equal(amountInWords(1000000000, INR), "Rupees One Crore Only");
  assert.equal(
    amountInWords(12345678900, INR),
    "Rupees Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine Only",
  );
});

test("amount in words uses western numbering for other currencies", () => {
  assert.equal(
    amountInWords(2043900, USD),
    "US Dollars Twenty Thousand Four Hundred Thirty Nine Only",
  );
  assert.equal(
    amountInWords(123456789, USD),
    "US Dollars One Million Two Hundred Thirty Four Thousand Five Hundred Sixty Seven and Eighty Nine Cents Only",
  );
  assert.equal(amountInWords(150000, JPY), "Yen One Hundred Fifty Thousand Only");
});

test("the grand total from the sample export quotation reads correctly", () => {
  // 17,321.00 taxable + 3,118.00 of duty = 20,439.00
  const d = computeDocument({
    taxMode: "export",
    currency: USD,
    customTaxes: [{ name: "Customs Duty", percent: 18 }],
    lines: [{ name: "Spares", quantity: 1, rate: 17321, gstRate: 0 }],
  });
  assert.equal(d.taxableValue, 1732100);
  assert.equal(d.customTaxTotal, 311778);
  assert.equal(
    amountInWords(d.total, USD),
    "US Dollars Twenty Thousand Four Hundred Thirty Eight and Seventy Eight Cents Only",
  );
});
