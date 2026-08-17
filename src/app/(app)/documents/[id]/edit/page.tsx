import { notFound } from "next/navigation";
import { getDocument } from "@/lib/actions/documents";
import { listCustomers } from "@/lib/actions/customers";
import { listProducts } from "@/lib/actions/products";
import { DocumentEditor } from "@/components/document-editor";
import {
  groupIntoSections,
  numStr,
  type EditorValues,
} from "@/lib/document-defaults";

export const dynamic = "force-dynamic";

const toDateInput = (d: Date | null) =>
  d ? new Date(d).toISOString().slice(0, 10) : "";

export default async function EditDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const documentId = Number(id);
  if (!Number.isFinite(documentId)) notFound();

  const [doc, customers, products] = await Promise.all([
    getDocument(documentId),
    listCustomers(),
    listProducts(),
  ]);

  if (!doc) notFound();

  const initial: EditorValues = {
    id: doc.id,
    type: doc.type,
    number: doc.number,
    status: doc.status,
    customerId: doc.customerId,
    currency: doc.currency,
    machineRef: doc.machineRef ?? "",
    issueDate: toDateInput(doc.issueDate),
    dueDate: toDateInput(doc.dueDate),
    validUntil: toDateInput(doc.validUntil),
    poNumber: doc.poNumber ?? "",
    notes: doc.notes ?? "",
    discountPercent: numStr(doc.discountPercent),
    shipping: numStr(doc.shipping),
    customTaxes: doc.parsedCustomTaxes.map((t) => ({
      name: t.name,
      percent: numStr(t.percent),
    })),
    sections: groupIntoSections(
      doc.items.map((i) => ({
        productId: i.productId,
        section: i.section,
        name: i.name,
        description: i.description ?? "",
        remark: i.remark ?? "",
        hsn: i.hsn ?? "",
        unit: i.unit,
        quantity: numStr(i.quantity),
        rate: numStr(i.rate),
        discountPercent: numStr(i.discountPercent),
        gstRate: numStr(i.gstRate),
      })),
    ),
  };

  return (
    <DocumentEditor
      initial={initial}
      customers={customers}
      products={products}
    />
  );
}
