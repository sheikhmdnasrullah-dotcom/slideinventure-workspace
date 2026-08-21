import { requireUser } from "@/lib/supabase/server";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default async function ResearchPage() {
  await requireUser();
  return (
    <ComingSoon
      title="Research"
      description="Agent research outputs rendered as evidence blocks — sources, key findings, citations, entity links. Backed by knowledge_items WHERE type = 'research'."
    />
  );
}
