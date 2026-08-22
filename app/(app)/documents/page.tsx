import { requireUser } from "@/lib/supabase/server";
import { DocumentsApp } from "@/components/dashboard/v3/documents/documents-app";

export default async function DocumentsPage() {
  await requireUser();

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] flex-col">
      <DocumentsApp navCollapsedSize={4} />
    </div>
  );
}
