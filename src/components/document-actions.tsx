"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  convertToInvoice,
  deleteDocument,
  updateDocumentStatus,
} from "@/lib/actions/documents";
import { Button, Select } from "@/components/ui";

const STATUSES: Record<string, { value: string; label: string }[]> = {
  quotation: [
    { value: "draft", label: "Draft" },
    { value: "sent", label: "Sent" },
    { value: "accepted", label: "Accepted" },
    { value: "rejected", label: "Rejected" },
    { value: "cancelled", label: "Cancelled" },
  ],
  invoice: [
    { value: "draft", label: "Draft" },
    { value: "sent", label: "Sent" },
    { value: "paid", label: "Paid" },
    { value: "cancelled", label: "Cancelled" },
  ],
};

export function DocumentActions({
  id,
  type,
  number,
  status,
  convertedToId,
}: {
  id: number;
  type: "quotation" | "invoice";
  number: string;
  status: string;
  convertedToId: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function changeStatus(next: string) {
    startTransition(async () => {
      const result = await updateDocumentStatus(
        id,
        next as "draft" | "sent" | "accepted" | "rejected" | "paid" | "cancelled",
      );
      if (!result.ok) setMessage(result.error);
      router.refresh();
    });
  }

  function convert() {
    startTransition(async () => {
      const result = await convertToInvoice(id);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      router.push(`/documents/${result.data.id}`);
      router.refresh();
    });
  }

  function remove() {
    if (!confirm(`Delete ${number}? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteDocument(id);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      router.push(type === "invoice" ? "/invoices" : "/quotations");
      router.refresh();
    });
  }

  return (
    <div className="no-print space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-900">{number}</h1>

          <div className="w-36">
            <Select
              value={status}
              onChange={(e) => changeStatus(e.target.value)}
              disabled={pending}
            >
              {STATUSES[type].map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="sm:ml-auto flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => window.print()} className="w-full sm:w-auto">
            Print / Save PDF
          </Button>

          {type === "quotation" && !convertedToId ? (
            <Button variant="secondary" onClick={convert} disabled={pending} className="w-full sm:w-auto">
              Convert to invoice
            </Button>
          ) : null}

          {convertedToId ? (
            <Link
              href={`/documents/${convertedToId}`}
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 text-center w-full sm:w-auto"
            >
              View invoice
            </Link>
          ) : null}

          <Link
            href={`/documents/${id}/edit`}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 text-center w-full sm:w-auto"
          >
            Edit
          </Link>

          <Button variant="danger" onClick={remove} disabled={pending} className="w-full sm:w-auto">
            Delete
          </Button>
        </div>
      </div>

      {message ? (
        <p className="rounded-lg bg-amber-50 px-3.5 py-2 text-sm text-amber-800">
          {message}
        </p>
      ) : null}

      <p className="text-xs text-slate-400">
        Print, then choose &ldquo;Save as PDF&rdquo; as the destination to get a
        PDF file.
      </p>
    </div>
  );
}
