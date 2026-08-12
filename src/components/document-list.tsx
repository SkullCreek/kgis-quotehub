import Link from "next/link";
import { listDocuments, type DocType } from "@/lib/actions/documents";
import { formatMoney } from "@/lib/money";
import { getCurrency } from "@/lib/currency";
import { StatusBadge } from "./status-badge";
import { EmptyState } from "./empty-state";

export async function DocumentList({
  type,
  title,
}: {
  type: DocType;
  title: string;
}) {
  const rows = await listDocuments({ type });
  const label = type === "invoice" ? "invoice" : "quotation";

  // Totals are kept per currency; adding rupees to dollars would be
  // meaningless without a conversion rate the app does not hold.
  const totals = new Map<string, number>();
  for (const r of rows) {
    if (r.status === "cancelled") continue;
    const currency = getCurrency(r.currency);
    const minor = Math.round(Number(r.total) * 10 ** currency.decimals);
    totals.set(r.currency, (totals.get(r.currency) ?? 0) + minor);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {rows.length ? (
          <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            {rows.length}
          </span>
        ) : null}
        {[...totals.entries()].map(([code, minor]) => (
          <span
            key={code}
            className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
          >
            {formatMoney(minor, getCurrency(code))}
          </span>
        ))}
        <Link
          href={`/documents/new?type=${type}`}
          className="ml-auto rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          New {label}
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        {rows.length === 0 ? (
          <EmptyState
            title={`No ${label}s yet`}
            body={`Create your first ${label} and it will appear here.`}
            actionHref={`/documents/new?type=${type}`}
            actionLabel={`New ${label}`}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 font-medium">Number</th>
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 font-medium">Ref.</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const currency = getCurrency(d.currency);
                return (
                  <tr
                    key={d.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/documents/${d.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {d.number}
                      </Link>
                      {d.convertedToId ? (
                        <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                          invoiced
                        </span>
                      ) : null}
                      {d.taxMode === "export" ? (
                        <span className="ml-2 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                          export
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {d.customerName}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {d.machineRef ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {new Date(d.issueDate).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium whitespace-nowrap text-slate-900">
                      {formatMoney(
                        Math.round(Number(d.total) * 10 ** currency.decimals),
                        currency,
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <Link
                        href={`/documents/${d.id}`}
                        className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                      >
                        View
                      </Link>
                      <Link
                        href={`/documents/${d.id}/edit`}
                        className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
