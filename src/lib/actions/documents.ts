"use server";

import { revalidatePath } from "next/cache";
import { eq, ne, desc, sql, and, or, ilike } from "drizzle-orm";
import { db } from "@/db";
import { documents, lineItems, customers } from "@/db/schema";
import { documentSchema } from "@/lib/validation";
import {
  computeDocument,
  resolveTaxMode,
  type TaxMode,
  type CustomTax,
} from "@/lib/gst";
import { minorToDecimalString } from "@/lib/money";
import { getCurrency } from "@/lib/currency";
import { COMPANY } from "@/config/company";
import type { ActionResult } from "./customers";

export type DocType = "quotation" | "invoice";

/** Frozen copy of the customer, written onto the document at save time. */
export interface CustomerSnapshot {
  name: string;
  contactPerson: string | null;
  gstin: string | null;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  stateCode: string | null;
  pincode: string | null;
  country: string;
}

async function nextSequence(type: DocType): Promise<number> {
  const rows = await db
    .select({ maxSeq: sql<number | null>`max(${documents.seq})` })
    .from(documents)
    .where(eq(documents.type, type));
  return (rows[0]?.maxSeq ?? 0) + 1;
}

/** Builds e.g. QTN-2026-KGIS010 from the numbering config. */
function formatNumber(type: DocType, seq: number): string {
  const n = COMPANY.numbering;
  const prefix = type === "invoice" ? n.invoicePrefix : n.quotationPrefix;
  const padded = String(seq).padStart(n.pad, "0");
  return [prefix, n.year, `${n.series}${padded}`].filter(Boolean).join("-");
}

export async function previewNextDocumentNumber(type: DocType): Promise<string> {
  const seq = await nextSequence(type);
  return formatNumber(type, seq);
}

/**
 * Inserts a document, allocating the next free number.
 *
 * Reading the highest sequence and inserting are two separate steps, so
 * two people saving at the same instant can pick the same number. The
 * unique index on `number` turns that into an error rather than a
 * duplicate, and this retries with a fresh sequence when it happens.
 */
async function insertWithNextNumber(
  type: DocType,
  values: Omit<typeof documents.$inferInsert, "seq" | "number">,
): Promise<{ id: number; number: string }> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 5; attempt++) {
    const seq = (await nextSequence(type)) + attempt;
    const number = formatNumber(type, seq);
    try {
      const inserted = await db
        .insert(documents)
        .values({ ...values, seq, number })
        .returning({ id: documents.id });
      return { id: inserted[0].id, number };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // Postgres 23505 is unique_violation; anything else is a real failure.
      if (!/duplicate key|unique constraint|23505/i.test(message)) throw e;
      lastError = e;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not allocate a document number.");
}

export async function listDocuments(opts?: { type?: DocType; query?: string }) {
  const filters = [];
  if (opts?.type) filters.push(eq(documents.type, opts.type));

  const q = opts?.query?.trim();
  if (q) {
    filters.push(
      or(ilike(documents.number, `%${q}%`), ilike(customers.name, `%${q}%`)),
    );
  }

  return db
    .select({
      id: documents.id,
      type: documents.type,
      status: documents.status,
      number: documents.number,
      issueDate: documents.issueDate,
      total: documents.total,
      currency: documents.currency,
      taxMode: documents.taxMode,
      machineRef: documents.machineRef,
      convertedToId: documents.convertedToId,
      customerName: customers.name,
      customerId: customers.id,
    })
    .from(documents)
    .innerJoin(customers, eq(documents.customerId, customers.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(documents.issueDate), desc(documents.id))
    .limit(200);
}

export async function getDocument(id: number) {
  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);
  const doc = rows[0];
  if (!doc) return null;

  const items = await db
    .select()
    .from(lineItems)
    .where(eq(lineItems.documentId, id))
    .orderBy(lineItems.position);

  return {
    ...doc,
    items,
    customer: JSON.parse(doc.customerSnapshot) as CustomerSnapshot,
    parsedCustomTaxes: safeParseCustomTaxes(doc.customTaxes),
  };
}

export type FullDocument = NonNullable<Awaited<ReturnType<typeof getDocument>>>;

/**
 * A custom tax as stored on the document: the rate that was charged
 * and the amount it came to, in the document's currency as a decimal
 * string. The amount is stored rather than recomputed so a printed
 * document can never disagree with what was saved.
 */
export interface StoredCustomTax extends CustomTax {
  amount: string;
}

/** Stored JSON should always be an array, but never trust it blindly. */
function safeParseCustomTaxes(raw: string | null): StoredCustomTax[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (t) => t && typeof t.name === "string" && typeof t.percent === "number",
      )
      .map((t) => ({
        name: t.name as string,
        percent: t.percent as number,
        // Older rows may predate the stored amount; fall back to "0"
        // rather than dropping the row off the document.
        amount: typeof t.amount === "string" ? t.amount : "0",
      }));
  } catch {
    return [];
  }
}

export async function saveDocument(
  raw: unknown,
): Promise<ActionResult<{ id: number; number: string }>> {
  const parsed = documentSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: firstError(parsed.error.flatten()),
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const v = parsed.data;

  const customerRows = await db
    .select()
    .from(customers)
    .where(eq(customers.id, v.customerId))
    .limit(1);
  const customer = customerRows[0];
  if (!customer) {
    return { ok: false, error: "That customer no longer exists." };
  }

  const currency = getCurrency(v.currency);

  const taxMode: TaxMode = resolveTaxMode(
    COMPANY.address.stateCode,
    customer.stateCode,
    customer.country,
  );

  const computed = computeDocument({
    taxMode,
    currency,
    discountPercent: v.discountPercent,
    shipping: v.shipping,
    customTaxes: v.customTaxes,
    lines: v.items.map((i) => ({
      name: i.name,
      description: i.description ?? null,
      remark: i.remark ?? null,
      section: i.section ?? null,
      hsn: i.hsn ?? null,
      unit: i.unit,
      quantity: i.quantity,
      rate: i.rate,
      discountPercent: i.discountPercent,
      gstRate: i.gstRate,
    })),
  });

  const snapshot: CustomerSnapshot = {
    name: customer.name,
    contactPerson: customer.contactPerson,
    gstin: customer.gstin,
    phone: customer.phone,
    email: customer.email,
    addressLine1: customer.addressLine1,
    addressLine2: customer.addressLine2,
    city: customer.city,
    state: customer.state,
    stateCode: customer.stateCode,
    pincode: customer.pincode,
    country: customer.country,
  };

  const money = (minor: number) => minorToDecimalString(minor, currency);

  const base = {
    type: v.type,
    number: v.number,
    status: v.status,
    customerId: v.customerId,
    customerSnapshot: JSON.stringify(snapshot),
    currency: currency.code,
    machineRef: v.machineRef ?? null,
    issueDate: new Date(v.issueDate),
    dueDate: v.dueDate ? new Date(v.dueDate) : null,
    validUntil: v.validUntil ? new Date(v.validUntil) : null,
    poNumber: v.poNumber ?? null,
    notes: v.notes ?? null,
    taxMode,
    discountPercent: v.discountPercent.toFixed(2),
    shipping: v.shipping.toFixed(2),
    // Store what was actually charged, including the resolved amounts,
    // so a later change to the tax list cannot rewrite history.
    customTaxes: JSON.stringify(
      computed.customTaxes.map((t) => ({
        name: t.name,
        percent: t.percent,
        amount: money(t.amount),
      })),
    ),
    subtotal: money(computed.subtotal),
    discountAmount: money(computed.discountAmount),
    taxableValue: money(computed.taxableValue),
    cgst: money(computed.cgst),
    sgst: money(computed.sgst),
    igst: money(computed.igst),
    customTaxTotal: money(computed.customTaxTotal),
    roundOff: money(computed.roundOff),
    total: money(computed.total),
    updatedAt: new Date(),
  };

  try {
    let documentId: number;
    let documentNumber: string;

    if (v.id) {
      const existing = await db
        .select({ number: documents.number })
        .from(documents)
        .where(eq(documents.id, v.id))
        .limit(1);
      if (!existing[0]) return { ok: false, error: "Document not found." };

      if (existing[0].number !== v.number) {
        const duplicate = await db
          .select({ id: documents.id })
          .from(documents)
          .where(and(eq(documents.number, v.number), ne(documents.id, v.id)))
          .limit(1);
        if (duplicate.length > 0) {
          return {
            ok: false,
            error: `Document number "${v.number}" is already in use. Please choose a unique number.`,
          };
        }
      }

      await db.update(documents).set(base).where(eq(documents.id, v.id));
      await db.delete(lineItems).where(eq(lineItems.documentId, v.id));
      documentId = v.id;
      documentNumber = v.number;
    } else {
      const duplicate = await db
        .select({ id: documents.id })
        .from(documents)
        .where(eq(documents.number, v.number))
        .limit(1);
      if (duplicate.length > 0) {
        return {
          ok: false,
          error: `Document number "${v.number}" is already in use. Please choose a unique number.`,
        };
      }

      const seq = await nextSequence(v.type);
      const inserted = await db
        .insert(documents)
        .values({ ...base, seq })
        .returning({ id: documents.id });
      documentId = inserted[0].id;
      documentNumber = v.number;
    }

    await db.insert(lineItems).values(
      computed.lines.map((l, index) => ({
        documentId,
        productId: v.items[index].productId ?? null,
        position: index,
        section: l.section,
        name: l.name,
        description: l.description,
        remark: l.remark,
        hsn: l.hsn,
        unit: l.unit,
        quantity: String(l.quantity),
        rate: money(l.rate),
        discountPercent: l.discountPercent.toFixed(2),
        gstRate: l.gstRate.toFixed(2),
        lineSubtotal: money(l.lineSubtotal),
        lineTaxable: money(l.lineTaxable),
        lineTax: money(l.lineTax),
        lineTotal: money(l.lineTotal),
      })),
    );

    revalidatePath("/quotations");
    revalidatePath("/invoices");
    revalidatePath(`/documents/${documentId}`);
    return { ok: true, data: { id: documentId, number: documentNumber } };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (/duplicate key|unique constraint|23505/i.test(message)) {
      return {
        ok: false,
        error: `Document number "${v.number}" is already in use. Please choose a unique number.`,
      };
    }
    if (message.includes("does not exist")) {
      return {
        ok: false,
        error:
          "The database tables are missing or out of date. Run `npm run db:push`.",
      };
    }
    return { ok: false, error: message };
  }
}

/**
 * Copies a quotation into a new invoice, keeping every line as it was
 * and linking the two so the quotation shows what it became.
 */
export async function convertToInvoice(
  quotationId: number,
): Promise<ActionResult<{ id: number; number: string }>> {
  const source = await getDocument(quotationId);
  if (!source) return { ok: false, error: "Quotation not found." };
  if (source.type !== "quotation") {
    return { ok: false, error: "Only quotations can be converted." };
  }
  if (source.convertedToId) {
    return {
      ok: false,
      error: "This quotation has already been converted to an invoice.",
    };
  }

  const now = new Date();

  try {
    const { id: invoiceId, number } = await insertWithNextNumber("invoice", {
      type: "invoice",
      status: "draft",
      customerId: source.customerId,
      customerSnapshot: source.customerSnapshot,
      currency: source.currency,
      machineRef: source.machineRef,
      issueDate: now,
      dueDate: null,
      validUntil: null,
      taxMode: source.taxMode,
      discountPercent: source.discountPercent,
      shipping: source.shipping,
      customTaxes: source.customTaxes,
      notes: source.notes,
      poNumber: source.poNumber,
      subtotal: source.subtotal,
      discountAmount: source.discountAmount,
      taxableValue: source.taxableValue,
      cgst: source.cgst,
      sgst: source.sgst,
      igst: source.igst,
      customTaxTotal: source.customTaxTotal,
      roundOff: source.roundOff,
      total: source.total,
      updatedAt: now,
    });

    if (source.items.length) {
      await db.insert(lineItems).values(
        source.items.map((i) => ({
          documentId: invoiceId,
          productId: i.productId,
          position: i.position,
          section: i.section,
          name: i.name,
          description: i.description,
          remark: i.remark,
          hsn: i.hsn,
          unit: i.unit,
          quantity: i.quantity,
          rate: i.rate,
          discountPercent: i.discountPercent,
          gstRate: i.gstRate,
          lineSubtotal: i.lineSubtotal,
          lineTaxable: i.lineTaxable,
          lineTax: i.lineTax,
          lineTotal: i.lineTotal,
        })),
      );
    }

    await db
      .update(documents)
      .set({ convertedToId: invoiceId, status: "accepted" })
      .where(eq(documents.id, quotationId));

    revalidatePath("/quotations");
    revalidatePath("/invoices");
    return { ok: true, data: { id: invoiceId, number } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function updateDocumentStatus(
  id: number,
  status: "draft" | "sent" | "accepted" | "rejected" | "paid" | "cancelled",
): Promise<ActionResult> {
  try {
    await db
      .update(documents)
      .set({ status, updatedAt: new Date() })
      .where(eq(documents.id, id));
    revalidatePath("/quotations");
    revalidatePath("/invoices");
    revalidatePath(`/documents/${id}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteDocument(id: number): Promise<ActionResult> {
  try {
    await db.delete(documents).where(eq(documents.id, id));
    revalidatePath("/quotations");
    revalidatePath("/invoices");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface CurrencyTotals {
  currency: string;
  invoiced: number;
  paid: number;
  outstanding: number;
  quoted: number;
}

/**
 * Totals are grouped by currency and never added together — a rupee
 * and a dollar are different things, and a combined figure would be
 * meaningless without a conversion rate the app does not hold.
 */
export async function dashboardStats(): Promise<{
  byCurrency: CurrencyTotals[];
  quotationCount: number;
  invoiceCount: number;
  exportCount: number;
}> {
  const rows = await db
    .select({
      type: documents.type,
      status: documents.status,
      total: documents.total,
      currency: documents.currency,
      taxMode: documents.taxMode,
    })
    .from(documents);

  const map = new Map<string, CurrencyTotals>();

  for (const r of rows) {
    const bucket =
      map.get(r.currency) ??
      { currency: r.currency, invoiced: 0, paid: 0, outstanding: 0, quoted: 0 };

    // Stored decimals are converted with the document's own currency so
    // 0-decimal currencies like JPY are not inflated by 100.
    const amount = Math.round(
      Number(r.total) * 10 ** getCurrency(r.currency).decimals,
    );

    if (r.type === "quotation") {
      bucket.quoted += amount;
    } else if (r.status !== "cancelled") {
      bucket.invoiced += amount;
      if (r.status === "paid") bucket.paid += amount;
      else bucket.outstanding += amount;
    }

    map.set(r.currency, bucket);
  }

  return {
    byCurrency: [...map.values()].sort((a, b) => b.invoiced - a.invoiced),
    quotationCount: rows.filter((r) => r.type === "quotation").length,
    invoiceCount: rows.filter((r) => r.type === "invoice").length,
    exportCount: rows.filter((r) => r.taxMode === "export").length,
  };
}

function firstError(flat: {
  formErrors: string[];
  fieldErrors: Record<string, string[] | undefined>;
}): string {
  if (flat.formErrors.length) return flat.formErrors[0];
  for (const messages of Object.values(flat.fieldErrors)) {
    if (messages?.length) return messages[0];
  }
  return "Please check the form and try again.";
}
