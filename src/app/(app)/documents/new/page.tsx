import Link from "next/link";
import { listCustomers } from "@/lib/actions/customers";
import { listProducts } from "@/lib/actions/products";
import { DocumentEditor } from "@/components/document-editor";
import {
  blankSection,
  todayISO,
  type EditorValues,
} from "@/lib/document-defaults";
import { COMPANY } from "@/config/company";

export const dynamic = "force-dynamic";

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; customer?: string }>;
}) {
  const params = await searchParams;
  const type = params.type === "invoice" ? "invoice" : "quotation";

  const [customers, products] = await Promise.all([
    listCustomers(),
    listProducts(),
  ]);

  if (customers.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">
          Add a customer first
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          A {type} needs someone to address it to. Add a customer, then come
          back here.
        </p>
        <Link
          href="/customers"
          className="mt-5 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Go to customers
        </Link>
      </div>
    );
  }

  const preselected = params.customer
    ? (customers.find((c) => c.id === Number(params.customer)) ?? null)
    : null;

  const initial: EditorValues = {
    type,
    status: "draft",
    customerId: preselected?.id ?? null,
    currency: preselected?.currency ?? "INR",
    machineRef: "",
    issueDate: todayISO(),
    dueDate: type === "invoice" ? todayISO(15) : "",
    validUntil:
      type === "quotation" ? todayISO(COMPANY.quotationValidityDays) : "",
    poNumber: "",
    notes: "",
    discountPercent: "0",
    shipping: "0",
    customTaxes: [],
    sections: [blankSection()],
  };

  return (
    <DocumentEditor
      initial={initial}
      customers={customers}
      products={products}
    />
  );
}
