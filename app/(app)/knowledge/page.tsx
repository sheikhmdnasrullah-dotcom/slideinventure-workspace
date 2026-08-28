import { requireUser } from "@/lib/supabase/server";
import { KnowledgeApp } from "@/components/dashboard/v3/knowledge/knowledge-app";
import { SiteHeader } from "@/components/dashboard/site-header";

export default async function KnowledgePage() {
  await requireUser();

  return (
    <>
      <SiteHeader crumbs={[{ label: "Knowledge" }]} subtitle="Second brain" />
      <div className="flex h-[calc(100vh-var(--header-height))] flex-col">
        <KnowledgeApp navCollapsedSize={4} />
      </div>
    </>
  );
}
