import { redirect } from "next/navigation"

import { getDashboardPreferencesForUser } from "@/lib/dashboard/preferences.server"
import { requireUser } from "@/lib/supabase/server"

export default async function WorkspaceEntryPage() {
  const user = await requireUser()
  const preferences = await getDashboardPreferencesForUser(user.email)

  redirect(preferences.defaultLandingPage)
}
