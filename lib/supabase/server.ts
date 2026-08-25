import 'server-only'
import { redirect } from 'next/navigation'
import { getSessionUser as getAppwriteUser } from '@/lib/appwrite/auth'

// Thin compatibility wrapper. All auth now resolves through Appwrite; this
// module exists so existing imports of `@/lib/supabase/server` keep working.
export async function getSessionUser() {
  const u = await getAppwriteUser()
  return u ? { id: u.id, email: u.email } : null
}

export async function requireUser() {
  const user = await getAppwriteUser()
  if (!user) redirect('/login')
  return user
}
