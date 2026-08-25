import 'server-only'
import { getSessionUser as getAppwriteUser } from '@/lib/appwrite/auth'
import { redirect } from 'next/navigation'

export async function getSessionUser() {
  const u = await getAppwriteUser()
  return u ? { id: u.id, email: u.email } : null
}

export async function requireUser() {
  const user = await getAppwriteUser()
  if (!user) redirect('/login')
  return user
}

export function createServiceClient() {
  throw new Error('Appwrite data operations should go through lib/appwrite/server.ts')
}
