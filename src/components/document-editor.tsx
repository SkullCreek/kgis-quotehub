"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Customer, Product } from "@/db/schema";
import { saveDocument } from "@/lib/actions/documents";
import { computeDocument, resolveTaxMode, GST_SLABS } from "@/lib/gst";
import { formatMoney } from "@/lib/money";
import { CURRENCIES, getCurrency } from "@/lib/currency";
import { COMPANY } from "@/config/company";
import { Button, Field, Select, TextArea, TextInput } from "@/components/ui";
import {
  blankLine,
  blankSection,
  flattenSections,
  numStr,
  CUSTOM_TAX_PRESETS,
  REMARK_PRESETS,
  UNITS,
  INCOTERMS_PRESETS,
  SHIPMENT_MODES,
  INDIAN_PORTS,
  type EditorLine,
  type EditorSection,
  type EditorValues,
} from "@/lib/document-defaults";

const num = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export function DocumentEditor({
  initial,
  customers,
  products,
}: {
  initial: EditorValues;
  customers: Customer[];
  products: Product[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<EditorValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isInvoice = values.type === "invoice";
  const isProforma = values.type === "proforma";
  const customer = customers.find((c) => c.id === values.customerId) ?? null;
  const currency = getCurrency(values.currency);

  const taxMode = resolveTaxMode(
    COMPANY.address.stateCode,
    customer?.stateCode,
    customer?.country,
  );
  const isExportDoc = taxMode === "export";

  const flatLines = useMemo(
    () => flattenSections(values.sections),
    [values.sections],
  );

  /** Recomputed on every keystroke so the totals panel is always live. */
  const computed = useMemo(
    () =>
      computeDocument({
        taxMode,
        currency,
        discountPercent: num(values.discountPercent),
        shipping: num(values.shipping),
        customTaxes: values.customTaxes.map((t) => ({
          name: t.name,
          percent: num(t.percent),
        })),
        lines: flatLines.map((i) => ({
          name: i.name || "Item",
          hsn: i.hsn,
          unit: i.unit,
          quantity: num(i.quantity),
          rate: num(i.rate),
          discountPercent: num(i.discountPercent),
          gstRate: num(i.gstRate),
        })),
      }),
    [values, taxMode, currency, flatLines],
  );

  const money = (minor: number) => formatMoney(minor, currency);

  /** Per-section subtotals, keyed by section index. */
  const sectionTotals = useMemo(() => {
    const totals: number[] = [];
    let cursor = 0;
    for (const section of values.sections) {
      let sum = 0;
      for (const item of section.items) {
        if (item.name.trim() === "") continue;
        sum += computed.lines[cursor]?.lineTotal ?? 0;
        cursor++;
      }
      totals.push(sum);
    }
    return totals;
  }, [values.sections, computed.lines]);

  /** Maps a (section, line) pair to its index in the flattened list. */
  function flatIndexOf(sectionIndex: number, lineIndex: number): number {
    let n = 0;
    for (let s = 0; s < sectionIndex; s++) {
      n += values.sections[s].items.filter((i) => i.name.trim() !== "").length;
    }
    for (let i = 0; i < lineIndex; i++) {
      if (values.sections[sectionIndex].items[i].name.trim() !== "") n++;
    }
    return n;
  }

  function set<K extends keyof EditorValues>(key: K, v: EditorValues[K]) {
    setValues((s) => ({ ...s, [key]: v }));
  }

  function setSections(updater: (s: EditorSection[]) => EditorSection[]) {
    setValues((s) => ({ ...s, sections: updater(s.sections) }));
  }

  function setLine(si: number, li: number, patch: Partial<EditorLine>) {
    setSections((sections) =>
      sections.map((sec, i) =>
        i !== si
          ? sec
          : {
              ...sec,
              items: sec.items.map((l, j) =>
                j === li ? { ...l, ...patch } : l,
              ),
            },
      ),
    );
  }

  function addLine(si: number) {
    setSections((sections) =>
      sections.map((sec, i) =>
        i === si ? { ...sec, items: [...sec.items, blankLine()] } : sec,
      ),
    );
  }

  function removeLine(si: number, li: number) {
    setSections((sections) =>
      sections.map((sec, i) =>
        i !== si
          ? sec
          : {
              ...sec,
              items:
                sec.items.length === 1
                  ? [blankLine()]
                  : sec.items.filter((_, j) => j !== li),
            },
      ),
    );
  }

  function addSection() {
    setSections((s) => [...s, blankSection("")]);
  }

  function removeSection(si: number) {
    setSections((s) => (s.length === 1 ? [blankSection()] : s.filter((_, i) => i !== si)));
  }

  /** Picking a saved product fills the whole row in one go. */
  function applyProduct(si: number, li: number, productId: string) {
    if (!productId) {
      setLine(si, li, { productId: null });
      return;
    }
    const p = products.find((x) => String(x.id) === productId);
    if (!p) return;
    setLine(si, li, {
      productId: p.id,
      name: p.name,
      description: p.description ?? "",
      hsn: p.hsn ?? "",
      unit: p.unit,
      rate: numStr(p.rate),
      gstRate: numStr(p.gstRate),
    });
  }

  // ---- custom taxes -------------------------------------------------
  function addCustomTax(preset?: { name: string; percent: string }) {
    set("customTaxes", [
      ...values.customTaxes,
      preset ? { ...preset } : { name: "", percent: "0" },
    ]);
  }

  function setCustomTax(index: number, patch: Partial<{ name: string; percent: string }>) {
    set(
      "customTaxes",
      values.customTaxes.map((t, i) => (i === index ? { ...t, ...patch } : t)),
    );
  }

  function removeCustomTax(index: number) {
    set(
      "customTaxes",
      values.customTaxes.filter((_, i) => i !== index),
    );
  }

  /** Selecting a customer adopts their default currency. */
  function selectCustomer(id: number | null) {
    const next = customers.find((c) => c.id === id) ?? null;
    setValues((s) => ({
      ...s,
      customerId: id,
      currency: next?.currency ?? s.currency,
    }));
  }

  function submit() {
    setError(null);

    const items = flatLines.map((i) => ({
      productId: i.productId,
      section: i.section,
      name: i.name,
      description: i.description,
      remark: i.remark,
      hsn: i.hsn,
      unit: i.unit,
      quantity: num(i.quantity),
      rate: num(i.rate),
      discountPercent: num(i.discountPercent),
      gstRate: num(i.gstRate),
    }));

    if (!values.customerId) {
      setError("Pick a customer first.");
      return;
    }
    if (!values.number?.trim()) {
      setError(
        `${isProforma ? "Proforma" : isInvoice ? "Invoice" : "Quotation"} number is required.`,
      );
      return;
    }
    if (items.length === 0) {
      setError("Add at least one line item with a description.");
      return;
    }

    const payload = {
      ...values,
      dueDate: values.dueDate || null,
      validUntil: values.validUntil || null,
      customTaxes: values.customTaxes
        .filter((t) => t.name.trim() !== "")
        .map((t) => ({ name: t.name, percent: num(t.percent) })),
      items,
    };

    startTransition(async () => {
      const result = await saveDocument(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/documents/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-900">
            {values.id ? "Edit" : "New"}{" "}
            {isProforma
              ? "proforma invoice"
              : isInvoice
                ? "invoice"
                : "quotation"}
          </h1>
          {isExportDoc ? (
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
              Export · zero-rated under GST
            </span>
          ) : null}
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Link
            href={
              isProforma
                ? "/proformas"
                : isInvoice
                  ? "/invoices"
                  : "/quotations"
            }
            className="flex-1 sm:flex-none text-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </Link>
          <Button onClick={submit} disabled={pending} className="flex-1 sm:flex-none">
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {/* ---- Header details ---- */}
      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 lg:grid-cols-3">
        <div className="space-y-3">
          <Field
            label="Customer"
            hint={
              customer
                ? isExportDoc
                  ? `${customer.country} — export, no GST charged.`
                  : taxMode === "igst"
                    ? `${customer.state ?? "Other state"} — IGST will be charged.`
                    : `${customer.state ?? COMPANY.address.state} — CGST + SGST will be charged.`
                : "Not sure who? Add them under Customers first."
            }
          >
            <Select
              value={values.customerId ? String(values.customerId) : ""}
              onChange={(e) =>
                selectCustomer(e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">Select a customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.city ? ` — ${c.city}` : ""}
                  {c.country && c.country !== "India" ? ` (${c.country})` : ""}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Currency">
              <Select
                value={values.currency}
                onChange={(e) => set("currency", e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Machine / project ref.">
              <TextInput
                value={values.machineRef}
                onChange={(e) => set("machineRef", e.target.value)}
                placeholder="M2407 / M2408"
              />
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:col-span-2">
          <Field
            label={
              isProforma
                ? "Proforma number"
                : isInvoice
                  ? "Invoice number"
                  : "Quotation number"
            }
          >
            <TextInput
              value={values.number}
              onChange={(e) => set("number", e.target.value)}
              placeholder={
                isProforma
                  ? "PI-2026-KGIS001"
                  : isInvoice
                    ? "INV-2026-KGIS001"
                    : "QTN-2026-KGIS001"
              }
            />
          </Field>

          <Field label="Issue date">
            <TextInput
              type="date"
              value={values.issueDate}
              onChange={(e) => set("issueDate", e.target.value)}
            />
          </Field>

          {isInvoice ? (
            <Field label="Due date">
              <TextInput
                type="date"
                value={values.dueDate}
                onChange={(e) => set("dueDate", e.target.value)}
              />
            </Field>
          ) : (
            <Field label="Valid until">
              <TextInput
                type="date"
                value={values.validUntil}
                onChange={(e) => set("validUntil", e.target.value)}
              />
            </Field>
          )}

          <Field label="Customer PO / reference">
            <TextInput
              value={values.poNumber}
              onChange={(e) => set("poNumber", e.target.value)}
            />
          </Field>

          <Field label="Status">
            <Select
              value={values.status}
              onChange={(e) => set("status", e.target.value)}
            >
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              {isInvoice ? (
                <>
                  <option value="paid">Paid</option>
                  <option value="cancelled">Cancelled</option>
                </>
              ) : (
                <>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                </>
              )}
            </Select>
          </Field>
        </div>
      </div>

      {/* ---- Export & Customs details card ---- */}
      {isExportDoc ? (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 pb-2.5">
            <div>
              <h2 className="text-sm font-semibold text-indigo-950">
                Indian Export Compliance &amp; Customs Details
              </h2>
              <p className="text-xs text-indigo-700">
                Required under IGST Act Section 16 &amp; Indian Customs (ICEGATE)
              </p>
            </div>
            <span className="rounded-md bg-indigo-100 px-2 py-1 text-[11px] font-mono font-medium text-indigo-800">
              IEC: {COMPANY.iec}
              {COMPANY.adCode ? ` | AD Code: ${COMPANY.adCode}` : ""}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Field label="Export GST Scheme" hint="Zero-rated supply under Sec 16">
              <Select
                value={values.exportScheme}
                onChange={(e) => set("exportScheme", e.target.value as "lut" | "paid")}
              >
                <option value="lut">Under LUT (Without payment of IGST)</option>
                <option value="paid">On Payment of IGST</option>
              </Select>
            </Field>

            {values.exportScheme === "lut" ? (
              <>
                <Field label="LUT Reference Number" hint="e.g. AD240325000123E">
                  <TextInput
                    value={values.exportLutNumber}
                    onChange={(e) => set("exportLutNumber", e.target.value)}
                    placeholder="LUT ARN / Ref No."
                  />
                </Field>

                <Field label="LUT Date">
                  <TextInput
                    type="date"
                    value={values.exportLutDate}
                    onChange={(e) => set("exportLutDate", e.target.value)}
                  />
                </Field>
              </>
            ) : null}

            <Field label="Port of Loading (India)">
              <TextInput
                value={values.portOfLoading}
                list="indian-ports-list"
                onChange={(e) => set("portOfLoading", e.target.value)}
                placeholder="Nhava Sheva (INNSA1) / ICD Vapi"
              />
            </Field>

            <Field label="Port of Discharge / Destination">
              <TextInput
                value={values.portOfDischarge}
                onChange={(e) => set("portOfDischarge", e.target.value)}
                placeholder="Jebel Ali (AEJEA) / Hamburg"
              />
            </Field>

            <Field label="Incoterms (Price/Delivery Terms)">
              <Select
                value={values.incoterms}
                onChange={(e) => set("incoterms", e.target.value)}
              >
                <option value="">Select Incoterms…</option>
                {INCOTERMS_PRESETS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Mode of Shipment">
              <Select
                value={values.modeOfShipment}
                onChange={(e) => set("modeOfShipment", e.target.value)}
              >
                <option value="">Select Mode…</option>
                {SHIPMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Country of Origin">
              <TextInput
                value={values.countryOfOrigin}
                onChange={(e) => set("countryOfOrigin", e.target.value)}
                placeholder="India"
              />
            </Field>

            <Field label="Packages (Count & Type)">
              <TextInput
                value={values.totalPackages}
                onChange={(e) => set("totalPackages", e.target.value)}
                placeholder="4 Wooden Crates / 10 Boxes"
              />
            </Field>

            <Field label="Net Weight">
              <TextInput
                value={values.netWeight}
                onChange={(e) => set("netWeight", e.target.value)}
                placeholder="450.00 Kg"
              />
            </Field>

            <Field label="Gross Weight">
              <TextInput
                value={values.grossWeight}
                onChange={(e) => set("grossWeight", e.target.value)}
                placeholder="510.00 Kg"
              />
            </Field>
          </div>

          <datalist id="indian-ports-list">
            {INDIAN_PORTS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
      ) : null}

      {/* ---- Sections of line items ---- */}
      {values.sections.map((section, si) => (
        <div key={si} className="rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
            <input
              value={section.name}
              onChange={(e) =>
                setSections((s) =>
                  s.map((sec, i) =>
                    i === si ? { ...sec, name: e.target.value } : sec,
                  ),
                )
              }
              placeholder={
                values.sections.length > 1
                  ? "Section name, e.g. M2407 — SPARE ELECTRICAL"
                  : "Section name (optional)"
              }
              className="min-w-64 flex-1 rounded-lg border border-transparent bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
            />
            <span className="text-sm text-slate-500">
              {money(sectionTotals[si] ?? 0)}
            </span>
            <Button variant="secondary" onClick={() => addLine(si)}>
              Add line
            </Button>
            {values.sections.length > 1 ? (
              <Button variant="ghost" onClick={() => removeSection(si)}>
                Remove section
              </Button>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="w-40 px-3 py-2 font-medium">Remark</th>
                  <th className="w-24 px-3 py-2 font-medium">HSN</th>
                  <th className="w-24 px-3 py-2 font-medium">Qty</th>
                  <th className="w-24 px-3 py-2 font-medium">Unit</th>
                  <th className="w-28 px-3 py-2 font-medium">Rate</th>
                  <th className="w-20 px-3 py-2 font-medium">Disc %</th>
                  {!isExportDoc ? (
                    <th className="w-24 px-3 py-2 font-medium">GST</th>
                  ) : null}
                  <th className="w-28 px-3 py-2 text-right font-medium">
                    Amount
                  </th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {section.items.map((line, li) => {
                  const fi =
                    line.name.trim() === "" ? -1 : flatIndexOf(si, li);
                  const computedLine = fi >= 0 ? computed.lines[fi] : null;
                  return (
                    <tr key={li} className="border-b border-slate-100 align-top">
                      <td className="px-3 py-2">
                        {products.length ? (
                          <Select
                            value={line.productId ? String(line.productId) : ""}
                            onChange={(e) =>
                              applyProduct(si, li, e.target.value)
                            }
                            className="mb-1.5"
                          >
                            <option value="">Type manually…</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </Select>
                        ) : null}
                        <TextInput
                          value={line.name}
                          placeholder="Item description"
                          onChange={(e) =>
                            setLine(si, li, { name: e.target.value })
                          }
                        />
                        <TextInput
                          value={line.description}
                          placeholder="Extra detail / part number (optional)"
                          onChange={(e) =>
                            setLine(si, li, { description: e.target.value })
                          }
                          className="mt-1.5 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <TextInput
                          value={line.remark}
                          list="remark-presets"
                          placeholder="SAME TO SAME"
                          onChange={(e) =>
                            setLine(si, li, { remark: e.target.value })
                          }
                          className="text-xs"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <TextInput
                          value={line.hsn}
                          onChange={(e) =>
                            setLine(si, li, { hsn: e.target.value })
                          }
                          className="font-mono"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <TextInput
                          type="number"
                          step="0.001"
                          min="0"
                          value={line.quantity}
                          onChange={(e) =>
                            setLine(si, li, { quantity: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={line.unit}
                          onChange={(e) =>
                            setLine(si, li, { unit: e.target.value })
                          }
                        >
                          {UNITS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <TextInput
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.rate}
                          onChange={(e) =>
                            setLine(si, li, { rate: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <TextInput
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={line.discountPercent}
                          onChange={(e) =>
                            setLine(si, li, { discountPercent: e.target.value })
                          }
                        />
                      </td>
                      {!isExportDoc ? (
                        <td className="px-3 py-2">
                          <Select
                            value={line.gstRate}
                            onChange={(e) =>
                              setLine(si, li, { gstRate: e.target.value })
                            }
                          >
                            {GST_SLABS.map((s) => (
                              <option key={s} value={String(s)}>
                                {s}%
                              </option>
                            ))}
                          </Select>
                        </td>
                      ) : null}
                      <td className="px-3 py-2 text-right">
                        <div className="pt-1.5 font-medium text-slate-900">
                          {money(computedLine?.lineTotal ?? 0)}
                        </div>
                        {!isExportDoc && computedLine?.lineTax ? (
                          <div className="text-xs text-slate-400">
                            incl. {formatMoney(computedLine.lineTax, currency, false)}{" "}
                            tax
                          </div>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          onClick={() => removeLine(si, li)}
                          aria-label="Remove line"
                          className="mt-1.5 rounded px-2 py-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <datalist id="remark-presets">
        {REMARK_PRESETS.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>

      <Button variant="secondary" onClick={addSection}>
        Add section
      </Button>

      {/* ---- Charges, custom taxes, totals ---- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Overall discount %" hint="Applied on the subtotal.">
                <TextInput
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={values.discountPercent}
                  onChange={(e) => set("discountPercent", e.target.value)}
                />
              </Field>
              <Field
                label={`Freight / packing (${currency.code})`}
                hint={
                  isExportDoc
                    ? "Added to the taxable value."
                    : "Taxed at each line's own rate."
                }
              >
                <TextInput
                  type="number"
                  step="0.01"
                  min="0"
                  value={values.shipping}
                  onChange={(e) => set("shipping", e.target.value)}
                />
              </Field>
            </div>

            <Field label="Notes" hint="Printed under the totals.">
              <TextArea
                rows={4}
                value={values.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Delivery in 3-4 weeks. Freight extra at actuals."
              />
            </Field>
          </div>

          {/* ---- Custom tax tab ---- */}
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">
                Custom taxes
              </h2>
              <span className="text-xs text-slate-400">
                % of taxable value
              </span>
              <Button
                variant="secondary"
                className="ml-auto"
                onClick={() => addCustomTax()}
              >
                Add tax
              </Button>
            </div>

            <div className="space-y-2 px-4 py-3">
              <p className="text-xs text-slate-500">
                {isExportDoc
                  ? "Exports are zero-rated under Indian GST. Add any tax the destination country levies here — VAT, customs duty, or a local levy."
                  : "For anything GST does not cover. Most domestic documents need none."}
              </p>

              {values.customTaxes.length === 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {CUSTOM_TAX_PRESETS.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => addCustomTax(p)}
                      className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-900 hover:text-slate-900"
                    >
                      + {p.name} {p.percent}%
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {values.customTaxes.map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <TextInput
                        value={t.name}
                        placeholder="Tax name, e.g. VAT"
                        onChange={(e) =>
                          setCustomTax(i, { name: e.target.value })
                        }
                      />
                      <div className="relative w-28 shrink-0">
                        <TextInput
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={t.percent}
                          onChange={(e) =>
                            setCustomTax(i, { percent: e.target.value })
                          }
                          className="pr-7"
                        />
                        <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-slate-400">
                          %
                        </span>
                      </div>
                      <span className="w-28 shrink-0 text-right text-sm text-slate-600">
                        {money(computed.customTaxes[i]?.amount ?? 0)}
                      </span>
                      <button
                        onClick={() => removeCustomTax(i)}
                        aria-label="Remove tax"
                        className="rounded px-2 py-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <dl className="space-y-1.5 text-sm">
            <Row label="Subtotal" value={money(computed.subtotal)} />
            {computed.discountAmount > 0 ? (
              <Row
                label="Discount"
                value={`− ${money(computed.discountAmount)}`}
                tone="text-emerald-600"
              />
            ) : null}
            {computed.shipping > 0 ? (
              <Row label="Freight" value={money(computed.shipping)} />
            ) : null}
            <Row label="Taxable value" value={money(computed.taxableValue)} />

            {taxMode === "igst" ? (
              <Row label="IGST" value={money(computed.igst)} />
            ) : taxMode === "cgst_sgst" ? (
              <>
                <Row label="CGST" value={money(computed.cgst)} />
                <Row label="SGST" value={money(computed.sgst)} />
              </>
            ) : (
              <Row
                label="GST (export, zero-rated)"
                value={money(0)}
                tone="text-slate-400"
              />
            )}

            {computed.customTaxes.map((t, i) => (
              <Row
                key={i}
                label={`${t.name} @ ${t.percent}%`}
                value={money(t.amount)}
              />
            ))}

            {computed.roundOff !== 0 ? (
              <Row
                label="Round off"
                value={`${computed.roundOff > 0 ? "+" : "−"} ${formatMoney(Math.abs(computed.roundOff), currency)}`}
              />
            ) : null}

            <div className="mt-2 flex items-baseline justify-between border-t border-slate-200 pt-2.5">
              <dt className="font-semibold text-slate-900">
                Total ({currency.code})
              </dt>
              <dd className="text-xl font-semibold text-slate-900">
                {money(computed.total)}
              </dd>
            </div>
          </dl>

          <Button className="mt-4 w-full" onClick={submit} disabled={pending}>
            {pending ? "Saving…" : `Save ${isInvoice ? "invoice" : "quotation"}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone = "text-slate-900",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className={tone}>{value}</dd>
    </div>
  );
}
