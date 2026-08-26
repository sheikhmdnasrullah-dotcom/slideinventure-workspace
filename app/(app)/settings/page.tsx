import { requireUser } from "@/lib/supabase/server"
import { SettingsControlCenter } from "@/components/dashboard/preferences/settings-control-center"

export default async function SettingsPage() {
  await requireUser()
  return <SettingsControlCenter />
}
