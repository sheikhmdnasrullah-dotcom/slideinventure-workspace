import { requireUser } from "@/lib/supabase/server"
import { SiteHeader } from "@/components/dashboard/site-header"
import { AcquisitionCommandCenter } from "@/components/dashboard/acquisition-command-center"

export default async function DashboardPage() {
  await requireUser()
  return (
    <>
      <SiteHeader crumbs={[{ label: "Command Center" }]} />
      <AcquisitionCommandCenter />
    </>
  )
}

