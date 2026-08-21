import { requireUser } from "@/lib/supabase/server";
import { DocumentsPanel } from "@/components/dashboard/documents-panel";

export default async function DocumentsPage() {
  await requireUser();

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-sm font-medium tracking-wide text-foreground/60 uppercase">
          Documents
        </h1>
        <p className="text-xs text-foreground/40">
          Upload and manage PDFs related to your business.
        </p>
      </div>
      <DocumentsPanel />
    </div>
  );
}
