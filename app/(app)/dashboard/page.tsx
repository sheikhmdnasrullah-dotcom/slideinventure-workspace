import { requireUser } from "@/lib/supabase/server"
import { DashboardHome } from "@/components/dashboard/dashboard-home"

export default async function DashboardPage() {
  await requireUser()
  return <DashboardHome />
}
