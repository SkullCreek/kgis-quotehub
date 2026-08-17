"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Customer } from "@/db/schema";
import { saveCustomer, deleteCustomer } from "@/lib/actions/customers";
import { STATE_CODES, stateCodeFromGstin, isExport } from "@/lib/gst";
import { CURRENCIES } from "@/lib/currency";
import { COMPANY } from "@/config/company";
import { Button, Drawer, Field, Select, TextArea, TextInput } from "@/components/ui";
import { EmptyState } from "@/components/empty-state";

type Draft = Partial<Customer> & { name: string };

const BLANK: Draft = {
  name: "",
  contactPerson: "",
  gstin: "",
  phone: "",
  email: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  stateCode: "",
  pincode: "",
  country: "India",
  currency: "INR",
  notes: "",
};

/** Common destinations first; any other country can be typed in. */
const COUNTRIES = [
  "India",
  "United Arab Emirates",
  "Saudi Arabia",
  "Oman",
  "Qatar",
  "Kuwait",
  "Bahrain",
  "Bangladesh",
  "Sri Lanka",
  "Nepal",
  "Singapore",
  "Malaysia",
  "Thailand",
  "Vietnam",
  "Indonesia",
  "China",
  "Japan",
  "South Korea",
  "Turkey",
  "Egypt",
  "Kenya",
  "Nigeria",
  "South Africa",
  "United Kingdom",
  "Germany",
  "Italy",
  "Netherlands",
  "United States",
  "Canada",
  "Mexico",
  "Brazil",
  "Australia",
  "New Zealand",
];

export function CustomerManager({ initial }: { initial: Customer[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initial;
    return initial.filter((c) =>
      [c.name, c.gstin, c.phone, c.city, c.email]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [initial, query]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  /** Filling in a GSTIN tells us the state, so fill that in too. */
  function onGstinChange(value: string) {
    const upper = value.toUpperCase();
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d, gstin: upper };
      const code = stateCodeFromGstin(upper);
      if (code) {
        next.stateCode = code;
        next.state = STATE_CODES.find((s) => s.code === code)?.name ?? d.state;
      }
      return next;
    });
  }

  function onStateChange(code: string) {
    setDraft((d) =>
      d
        ? {
            ...d,
            stateCode: code,
            state: STATE_CODES.find((s) => s.code === code)?.name ?? "",
          }
        : d,
    );
  }

  function save() {
    if (!draft) return;
    setFormError(null);
    setErrors({});
    startTransition(async () => {
      const result = await saveCustomer(draft);
      if (!result.ok) {
        setFormError(result.error);
        setErrors(result.fieldErrors ?? {});
        return;
      }
      setDraft(null);
      router.refresh();
    });
  }

  function remove(id: number, name: string) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteCustomer(id);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  const overseas = isExport(draft?.country);
  const interState =
    !overseas &&
    draft?.stateCode &&
    draft.stateCode !== COMPANY.address.stateCode;

  /** Switching country picks a sensible default currency to go with it. */
  function onCountryChange(country: string) {
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d, country };
      if (!isExport(country)) {
        next.currency = "INR";
      } else if (d.currency === "INR" || !d.currency) {
        next.currency = "USD";
      }
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Customers</h1>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, GSTIN, phone…"
          className="w-full sm:w-64 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
        />
        <Button className="w-full sm:w-auto sm:ml-auto" onClick={() => setDraft({ ...BLANK })}>
          Add customer
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        {filtered.length === 0 ? (
          <EmptyState
            title={query ? "No matches" : "No customers yet"}
            body={
              query
                ? "Try a different search term."
                : "Add a customer once and reuse them on every quotation and invoice."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">GSTIN</th>
                  <th className="px-4 py-2 font-medium">Place</th>
                  <th className="px-4 py-2 font-medium">Contact</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {c.name}
                      {c.contactPerson ? (
                        <span className="block text-xs font-normal text-slate-500">
                          {c.contactPerson}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                      {c.gstin ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                      {isExport(c.country) ? (
                        <span className="ml-1.5 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                          {c.country} · {c.currency}
                        </span>
                      ) : c.stateCode &&
                        c.stateCode !== COMPANY.address.stateCode ? (
                        <span className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          IGST
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {c.phone ?? c.email ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => setDraft(c)}
                        className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => remove(c.id, c.name)}
                        className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Drawer
        open={draft !== null}
        title={draft?.id ? "Edit customer" : "Add customer"}
        onClose={() => setDraft(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending || !draft?.name?.trim()}>
              {pending ? "Saving…" : "Save customer"}
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

            <Field label="Business name *" error={errors.name?.[0]}>
              <TextInput
                value={draft.name ?? ""}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Acme Corporation"
                invalid={!!errors.name}
                autoFocus
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field
                label="Country"
                hint={
                  overseas
                    ? "Export customer — GSTIN & domestic state fields are hidden."
                    : "Domestic customer."
                }
              >
                <TextInput
                  value={draft.country ?? "India"}
                  list="country-list"
                  onChange={(e) => onCountryChange(e.target.value)}
                />
              </Field>
              <Field
                label="Default currency"
                hint="Used on new documents."
              >
                <Select
                  value={draft.currency ?? "INR"}
                  onChange={(e) => set("currency", e.target.value)}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <datalist id="country-list">
              {COUNTRIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Contact person (Optional)">
                <TextInput
                  value={draft.contactPerson ?? ""}
                  onChange={(e) => set("contactPerson", e.target.value)}
                />
              </Field>
              <Field label="Phone (Optional)">
                <TextInput
                  value={draft.phone ?? ""}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </Field>
            </div>

            <Field label="Email (Optional)" error={errors.email?.[0]}>
              <TextInput
                type="email"
                value={draft.email ?? ""}
                onChange={(e) => set("email", e.target.value)}
                invalid={!!errors.email}
              />
            </Field>

            {!overseas ? (
              <Field
                label="GSTIN (Optional)"
                error={errors.gstin?.[0]}
                hint="Leave blank for unregistered customers."
              >
                <TextInput
                  value={draft.gstin ?? ""}
                  onChange={(e) => onGstinChange(e.target.value)}
                  placeholder="24AAAAA0000A1Z5"
                  maxLength={15}
                  className="font-mono uppercase"
                  invalid={!!errors.gstin}
                />
              </Field>
            ) : null}

            <Field label="Address line 1 (Optional)">
              <TextInput
                value={draft.addressLine1 ?? ""}
                onChange={(e) => set("addressLine1", e.target.value)}
              />
            </Field>
            <Field label="Address line 2 (Optional)">
              <TextInput
                value={draft.addressLine2 ?? ""}
                onChange={(e) => set("addressLine2", e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="City (Optional)">
                <TextInput
                  value={draft.city ?? ""}
                  onChange={(e) => set("city", e.target.value)}
                />
              </Field>
              <Field label="PIN / Postal code (Optional)">
                <TextInput
                  value={draft.pincode ?? ""}
                  onChange={(e) => set("pincode", e.target.value)}
                />
              </Field>
            </div>

            {overseas ? (
              <Field label="State / Province (Optional)">
                <TextInput
                  value={draft.state ?? ""}
                  onChange={(e) => set("state", e.target.value)}
                />
              </Field>
            ) : (
              <Field
                label="State (place of supply) (Optional)"
                hint={
                  interState
                    ? `Different from ${COMPANY.address.state}, so IGST will be charged.`
                    : `Same state as you, so CGST + SGST will be charged.`
                }
              >
                <Select
                  value={draft.stateCode ?? ""}
                  onChange={(e) => onStateChange(e.target.value)}
                >
                  <option value="">Select a state…</option>
                  {STATE_CODES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <Field label="Internal notes (Optional)" hint="Never printed on documents.">
              <TextArea
                rows={3}
                value={draft.notes ?? ""}
                onChange={(e) => set("notes", e.target.value)}
              />
            </Field>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
