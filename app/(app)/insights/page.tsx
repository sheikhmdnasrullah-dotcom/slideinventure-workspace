import { requireUser } from "@/lib/supabase/server";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default async function InsightsPage() {
  await requireUser();
  return (
    <ComingSoon
      title="Insights"
      description="AI-discovered, citable statements derived from the knowledge base. Each insight links back to the chunk that produced it. Status = proposed until the founder marks confirmed."
    />
  );
}
