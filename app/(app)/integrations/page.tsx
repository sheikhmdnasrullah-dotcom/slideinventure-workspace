import { requireUser } from "@/lib/supabase/server";
import { IntegrationsClient } from "@/components/dashboard/integrations/integrations-client";
import { IntegrationsHub } from "@/components/dashboard/integrations/integrations-hub";
import { getIntegrationStatuses } from "@/lib/integrations/status";

export default async function IntegrationsPage() {
  await requireUser();
  const statuses = getIntegrationStatuses();
  return (
    <div className="flex flex-col gap-6">
      <IntegrationsClient />
      <IntegrationsHub statuses={statuses} />
    </div>
  );
}
