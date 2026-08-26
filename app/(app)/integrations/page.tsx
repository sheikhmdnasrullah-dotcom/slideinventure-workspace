import { requireUser } from "@/lib/supabase/server"
import { IntegrationsClient } from "@/components/dashboard/integrations/integrations-client"

export default async function IntegrationsPage() {
  await requireUser()
  return <IntegrationsClient />
}
