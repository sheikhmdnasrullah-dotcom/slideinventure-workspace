import { requireUser } from "@/lib/supabase/server";
import { DocumentsApp } from "@/components/dashboard/v3/documents/documents-app";
import { SiteHeader } from "@/components/dashboard/site-header";

export default async function DocumentsPage() {
  await requireUser();

  return (
    <>
      <SiteHeader crumbs={[{ label: "Documents" }]} subtitle="Workspace" />
      <div className="flex h-[calc(100vh-var(--header-height))] flex-col">
        <DocumentsApp navCollapsedSize={4} />
      </div>
    </>
  );
}
