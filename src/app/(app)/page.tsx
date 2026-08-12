import Link from "next/link";
import { dashboardStats, listDocuments } from "@/lib/actions/documents";
import { formatMoney } from "@/lib/money";
import { getCurrency } from "@/lib/currency";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let stats: Awaited<ReturnType<typeof dashboardStats>> | null = null;
  let recent: Awaited<ReturnType<typeof listDocuments>> = [];
  let dbError: string | null = null;

  try {
    [stats, recent] = await Promise.all([dashboardStats(), listDocuments()]);
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  if (dbError) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
        <h2 className="font-semibold text-amber-900">
          Cannot reach the database yet
        </h2>
        <p className="mt-2 text-sm text-amber-800">
          Add your <code className="font-mono">DATABASE_URL</code> to{" "}
          <code className="font-mono">.env.local</code>, then run{" "}
          <code className="font-mono">npm run db:push</code> to create the
          tables.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-amber-100 p-3 text-xs text-amber-900">
          {dbError}
        </pre>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        {stats!.exportCount > 0 ? (
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
            {stats!.exportCount} export{stats!.exportCount === 1 ? "" : "s"}
          </span>
        ) : null}
        <div className="ml-auto flex gap-2">
          <Link
            href="/documents/new?type=quotation"
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            New quotation
          </Link>
          <Link
            href="/documents/new?type=invoice"
            className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            New invoice
          </Link>
        </div>
      </div>

      {/* One row of figures per currency — rupees and dollars are never
          added together, since the app holds no conversion rate. */}
      {stats!.byCurrency.length === 0 ? null : (
        <div className="space-y-3">
          {stats!.byCurrency.map((row) => {
            const currency = getCurrency(row.currency);
            const cards = [
              { label: "Invoiced", value: row.invoiced, tone: "text-slate-900" },
              { label: "Received", value: row.paid, tone: "text-emerald-600" },
              {
                label: "Outstanding",
                value: row.outstanding,
                tone: "text-amber-600",
              },
              { label: "Quoted", value: row.quoted, tone: "text-slate-500" },
            ];
            return (
              <div key={row.currency}>
                {stats!.byCurrency.length > 1 ? (
                  <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {currency.code} — {currency.name}
                  </div>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {cards.map((c) => (
                    <div
                      key={c.label}
                      className="rounded-xl border border-slate-200 bg-white p-4"
                    >
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {c.label}
                      </div>
                      <div
                        className={`mt-1.5 text-2xl font-semibold ${c.tone}`}
                      >
                        {formatMoney(c.value, currency)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Recent documents
          </h2>
        </div>

        {recent.length === 0 ? (
          <EmptyState
            title="Nothing here yet"
            body="Create your first quotation or invoice to see it listed here."
            actionHref="/documents/new?type=quotation"
            actionLabel="New quotation"
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 font-medium">Number</th>
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {recent.slice(0, 10).map((d) => {
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
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {d.customerName}
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
