import { requireUser } from "@/lib/supabase/server";
import { KnowledgeApp } from "@/components/dashboard/v3/knowledge/knowledge-app";

export default async function KnowledgePage() {
  await requireUser();

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] flex-col">
      <KnowledgeApp navCollapsedSize={4} />
    </div>
  );
}
