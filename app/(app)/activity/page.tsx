import { requireUser } from "@/lib/supabase/server";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default async function ActivityPage() {
  await requireUser();
  return (
    <ComingSoon
      title="Activity"
      description="Every event in the system — knowledge writes, agent runs, n8n webhooks, search queries — in one filterable stream. Will reuse the existing task_runs + knowledge_item_versions tables."
    />
  );
}
