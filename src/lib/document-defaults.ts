/**
 * Shapes and defaults shared by the editor and the server components
 * that build its initial state.
 *
 * These live outside the editor module on purpose: that file is marked
 * "use client", and a server component cannot call a function exported
 * from a client module.
 */

import type { DocType } from "./actions/documents";

export interface EditorLine {
  productId: number | null;
  name: string;
  description: string;
  remark: string;
  hsn: string;
  unit: string;
  quantity: string;
  rate: string;
  discountPercent: string;
  gstRate: string;
}

/**
 * A named group of lines, printed as its own block with a subtotal.
 * A document with one unnamed section prints as a plain flat list.
 */
export interface EditorSection {
  name: string;
  items: EditorLine[];
}

export interface EditorCustomTax {
  name: string;
  percent: string;
}

export interface EditorValues {
  id?: number;
  type: DocType;
  number: string;
  status: string;
  customerId: number | null;
  currency: string;
  machineRef: string;
  issueDate: string;
  dueDate: string;
  validUntil: string;
  poNumber: string;
  notes: string;
  discountPercent: string;
  shipping: string;
  customTaxes: EditorCustomTax[];
  sections: EditorSection[];
}

export const UNITS = [
  "Nos",
  "Pcs",
  "Set",
  "Box",
  "Kg",
  "Gm",
  "Ltr",
  "Mtr",
  "Sqft",
  "Hrs",
  "Days",
  "Job",
];

/** Suggestions offered under the remark field; any text is allowed. */
export const REMARK_PRESETS = [
  "SAME TO SAME",
  "MODEL CHANGE",
  "WITHOUT PROG",
  "ALTERNATE",
  "REFURBISHED",
];

/** Ready-made tax rows offered when adding a custom tax. */
export const CUSTOM_TAX_PRESETS: { name: string; percent: string }[] = [
  { name: "VAT", percent: "5" },
  { name: "Customs Duty", percent: "10" },
  { name: "Excise Duty", percent: "5" },
  { name: "Withholding Tax", percent: "2" },
  { name: "Service Charge", percent: "1" },
];

export function blankLine(): EditorLine {
  return {
    productId: null,
    name: "",
    description: "",
    remark: "",
    hsn: "",
    unit: "Nos",
    quantity: "1",
    rate: "",
    discountPercent: "0",
    gstRate: "18",
  };
}

export function blankSection(name = ""): EditorSection {
  return { name, items: [blankLine()] };
}

/** Today, or a number of days from today, as a yyyy-mm-dd string. */
export function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  // Build from local parts so a late-evening IST session does not
  // record yesterday's date via UTC.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Normalises a numeric column for use as a form value.
 *
 * Postgres returns `numeric` as a fixed-scale string: "18.00", "3.000".
 * A <select> whose options are "18" would not match "18.00" and would
 * silently fall back to its first option — which, for a GST dropdown,
 * means quietly resetting the slab to 0%. Comparing normalised numbers
 * avoids that.
 */
export function numStr(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "0";
  const n = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(n) ? String(n) : "0";
}

/** Flattens the editor's sections into the ordered line list the API takes. */
export function flattenSections(sections: EditorSection[]) {
  const out: (EditorLine & { section: string | null })[] = [];
  for (const section of sections) {
    for (const item of section.items) {
      if (item.name.trim() === "") continue;
      out.push({ ...item, section: section.name.trim() || null });
    }
  }
  return out;
}

/** Rebuilds sections from a saved document's flat, ordered line list. */
export function groupIntoSections(
  items: (EditorLine & { section: string | null })[],
): EditorSection[] {
  const sections: EditorSection[] = [];
  for (const item of items) {
    const name = item.section ?? "";
    const last = sections[sections.length - 1];
    if (last && last.name === name) {
      last.items.push(item);
    } else {
      sections.push({ name, items: [item] });
    }
  }
  return sections.length ? sections : [blankSection()];
}
