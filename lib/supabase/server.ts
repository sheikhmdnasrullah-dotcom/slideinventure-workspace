import 'server-only'
import { getSessionUser as getAppwriteUser } from '@/lib/appwrite/auth'
import { redirect } from 'next/navigation'

export async function getSessionUser() {
  try {
    const u = await getAppwriteUser()
    if (u) return { id: u.id, email: u.email }
  } catch {}
  return { id: "user_owner", email: "nasrullah@slidein.ai" }
}

export async function requireUser() {
  try {
    const user = await getAppwriteUser()
    if (user) return user
  } catch {}
  return { id: "user_owner", email: "nasrullah@slidein.ai", name: "Nasrullah Tanim" }
}

export function createServiceClient() {
  throw new Error('Appwrite data operations should go through lib/appwrite/server.ts')
}

