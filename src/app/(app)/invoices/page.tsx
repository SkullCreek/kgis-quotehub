import { DocumentList } from "@/components/document-list";

export const dynamic = "force-dynamic";

export default function InvoicesPage() {
  return <DocumentList type="invoice" title="Invoices" />;
}
