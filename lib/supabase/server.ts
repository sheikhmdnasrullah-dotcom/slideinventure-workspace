import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

// Supabase session resolver. Kept as the canonical `getSessionUser` export so
// that lib/appwrite/auth.ts — which imports this by name as its fallback —
// resolves to the Supabase session (NOT the Appwrite function, which would
// create an infinite loop). Direct Supabase-login sessions resolve here.
export async function getSessionUser() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user
  } catch {
    return null
  }
}

// Appwrite-first bridge used by requireUser(): resolves the Appwrite session
// cookie and falls back to the Supabase session above during the migration
// window (lib/appwrite/auth already delegates to this module's getSessionUser).
import { getSessionUser as getAppwriteUser } from '@/lib/appwrite/auth'

// Redirects to /login if there's no session. Use at the top of any
// root-level page instead of duplicating the getSessionUser()+redirect check.
export async function requireUser() {
  const user = await getAppwriteUser()
  if (!user) {
    redirect('/login')
  }
  return user
}

// Session-aware client for Server Components, Server Actions, and Route
// Handlers. Respects the logged-in user's cookies and RLS policies.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component render — cookies can't be set
            // here. Proxy already refreshes the session, so this is safe.
          }
        },
      },
    }
  )
}

// Admin client bypassing RLS. No user session — use only for trusted
// server-side operations, never to authenticate a request.
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
