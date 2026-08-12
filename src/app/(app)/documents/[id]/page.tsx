import { notFound } from "next/navigation";
import { getDocument } from "@/lib/actions/documents";
import { PrintSheet } from "@/components/print-sheet";
import { DocumentActions } from "@/components/document-actions";

export const dynamic = "force-dynamic";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const documentId = Number(id);
  if (!Number.isFinite(documentId)) notFound();

  const doc = await getDocument(documentId);
  if (!doc) notFound();

  return (
    <div className="space-y-4">
      <DocumentActions
        id={doc.id}
        type={doc.type}
        number={doc.number}
        status={doc.status}
        convertedToId={doc.convertedToId}
      />
      <PrintSheet doc={doc} />
    </div>
  );
}
