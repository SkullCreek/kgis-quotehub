"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/db/schema";
import { saveProduct, deleteProduct } from "@/lib/actions/products";
import { GST_SLABS } from "@/lib/gst";
import { numStr } from "@/lib/document-defaults";
import { formatMoney } from "@/lib/money";
import { getCurrency } from "@/lib/currency";
import { Button, Drawer, Field, Select, TextArea, TextInput } from "@/components/ui";
import { EmptyState } from "@/components/empty-state";

type Draft = {
  id?: number;
  name: string;
  description: string;
  hsn: string;
  unit: string;
  rate: string;
  gstRate: string;
  isActive: boolean;
};

const UNITS = ["Nos", "Pcs", "Set", "Box", "Kg", "Gm", "Ltr", "Mtr", "Sqft", "Hrs", "Days", "Job"];

/**
 * The product catalogue holds one base rate, kept in rupees. A document
 * raised in another currency uses that number as-is, so the rate is
 * adjusted on the line when quoting abroad.
 */
const INR = getCurrency("INR");

const BLANK: Draft = {
  name: "",
  description: "",
  hsn: "",
  unit: "Nos",
  rate: "",
  gstRate: "18",
  isActive: true,
};

function toDraft(p: Product): Draft {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    hsn: p.hsn ?? "",
    unit: p.unit,
    // Normalised so the GST <select> matches: see numStr.
    rate: numStr(p.rate),
    gstRate: numStr(p.gstRate),
    isActive: p.isActive === 1,
  };
}

export function ProductManager({ initial }: { initial: Product[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initial;
    return initial.filter((p) =>
      [p.name, p.hsn, p.description]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [initial, query]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  function save() {
    if (!draft) return;
    setFormError(null);
    setErrors({});
    startTransition(async () => {
      const result = await saveProduct({
        ...draft,
        rate: draft.rate === "" ? 0 : draft.rate,
      });
      if (!result.ok) {
        setFormError(result.error);
        setErrors(result.fieldErrors ?? {});
        return;
      }
      setDraft(null);
      router.refresh();
    });
  }

  function archive(id: number, name: string) {
    if (!confirm(`Archive ${name}? It will stop appearing when you add lines, but existing documents keep it.`)) return;
    startTransition(async () => {
      const result = await deleteProduct(id);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-slate-900">
          Products &amp; services
        </h1>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or HSN…"
          className="w-64 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
        />
        <Button className="ml-auto" onClick={() => setDraft({ ...BLANK })}>
          Add product
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        {filtered.length === 0 ? (
          <EmptyState
            title={query ? "No matches" : "No products yet"}
            body={
              query
                ? "Try a different search term."
                : "Save the things you sell here so line items fill themselves in."
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">HSN / SAC</th>
                <th className="px-4 py-2 font-medium">Unit</th>
                <th className="px-4 py-2 text-right font-medium">Rate</th>
                <th className="px-4 py-2 text-right font-medium">GST</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className={
                    "border-b border-slate-100 last:border-0 hover:bg-slate-50 " +
                    (p.isActive === 0 ? "opacity-50" : "")
                  }
                >
                  <td className="px-4 py-2.5 font-medium text-slate-900">
                    {p.name}
                    {p.isActive === 0 ? (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                        archived
                      </span>
                    ) : null}
                    {p.description ? (
                      <span className="block text-xs font-normal text-slate-500">
                        {p.description}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                    {p.hsn ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{p.unit}</td>
                  <td className="px-4 py-2.5 text-right text-slate-900">
                    {formatMoney(Number(p.rate) * 100, INR)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-600">
                    {Number(p.gstRate)}%
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button
                      onClick={() => setDraft(toDraft(p))}
                      className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                    >
                      Edit
                    </button>
                    {p.isActive === 1 ? (
                      <button
                        onClick={() => archive(p.id, p.name)}
                        className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Archive
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Drawer
        open={draft !== null}
        title={draft?.id ? "Edit product" : "Add product"}
        onClose={() => setDraft(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending || !draft?.name.trim()}>
              {pending ? "Saving…" : "Save product"}
            </Button>
          </>
        }
      >
        {draft ? (
          <div className="space-y-3">
            {formError ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </p>
            ) : null}

            <Field label="Name" error={errors.name?.[0]}>
              <TextInput
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
                invalid={!!errors.name}
                autoFocus
              />
            </Field>

            <Field
              label="Description"
              hint="Printed under the name on the document."
            >
              <TextArea
                rows={2}
                value={draft.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field
                label="HSN / SAC code"
                hint="HSN for goods, SAC for services."
              >
                <TextInput
                  value={draft.hsn}
                  onChange={(e) => set("hsn", e.target.value)}
                  className="font-mono"
                />
              </Field>
              <Field label="Unit">
                <Select
                  value={draft.unit}
                  onChange={(e) => set("unit", e.target.value)}
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Rate per unit (₹)"
                hint="Excluding GST."
                error={errors.rate?.[0]}
              >
                <TextInput
                  type="number"
                  step="0.01"
                  min="0"
                  value={draft.rate}
                  onChange={(e) => set("rate", e.target.value)}
                  invalid={!!errors.rate}
                />
              </Field>
              <Field label="GST slab">
                <Select
                  value={draft.gstRate}
                  onChange={(e) => set("gstRate", e.target.value)}
                >
                  {GST_SLABS.map((s) => (
                    <option key={s} value={String(s)}>
                      {s}%
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <label className="flex items-center gap-2 pt-1 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(e) => set("isActive", e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Active — show this when adding line items
            </label>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
