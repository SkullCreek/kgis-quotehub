import { DocumentList } from "@/components/document-list";

export const dynamic = "force-dynamic";

export default function ProformasPage() {
  return <DocumentList type="proforma" title="Proforma Invoices" />;
}
