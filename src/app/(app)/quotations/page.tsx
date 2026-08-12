import { DocumentList } from "@/components/document-list";

export const dynamic = "force-dynamic";

export default function QuotationsPage() {
  return <DocumentList type="quotation" title="Quotations" />;
}
