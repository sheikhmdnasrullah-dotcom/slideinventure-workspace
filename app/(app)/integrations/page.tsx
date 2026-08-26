import { requireUser } from "@/lib/supabase/server"
import { IntegrationsClient } from "@/components/dashboard/integrations/integrations-client"
import { ComposioConnections } from "@/components/dashboard/integrations/composio-connections"

export default async function IntegrationsPage() {
  await requireUser()
  return (
    <div className="flex flex-col gap-6">
      <IntegrationsClient />
      <div className="flex flex-col gap-2 px-6 pb-6">
        <h2 className="text-xs font-medium uppercase tracking-wide text-foreground/60">Composio connections</h2>
        <ComposioConnections />
      </div>
    </div>
  )
}
