import { requireUser } from "@/lib/supabase/server";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default async function InsightsPage() {
  await requireUser();
  return (
    <ComingSoon
      title="Insights"
      description="Statements derived from the knowledge base. Each links back to the chunk that produced it. Status stays proposed until confirmed."
    />
  );
}
