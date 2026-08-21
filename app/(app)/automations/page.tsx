import { requireUser } from "@/lib/supabase/server";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default async function AutomationsPage() {
  await requireUser();

  return (
    <ComingSoon
      title="Automations (n8n)"
      description="Workflow status and run history from n8n will appear here once webhooks are wired in."
    />
  );
}
