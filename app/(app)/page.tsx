import { redirect } from "next/navigation"

import { getDashboardPreferencesForUser } from "@/lib/dashboard/preferences.server"
import { isIntakeComplete } from "@/lib/intake/store"
import { requireUser } from "@/lib/supabase/server"

export const dynamic = "force-dynamic";

export default async function WorkspaceEntryPage() {
  // Fresh installs land on intake first: agents need the business profile
  // before research or outreach can run against it.
  if (!isIntakeComplete()) redirect("/intake")
  const user = await requireUser()
  const preferences = await getDashboardPreferencesForUser(user.email)

  redirect(preferences.defaultLandingPage)
}
