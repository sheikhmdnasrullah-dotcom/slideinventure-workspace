import { NextResponse, type NextRequest } from 'next/server'

// Appwrite sessions are cookie-based and need no server-side refresh; routes
// self-protect via getSessionUser(). This is a pass-through that simply
// forwards the request. Kept as a seam in case future middleware logic is
// needed.
export async function updateSession(request: NextRequest) {
  return NextResponse.next({ request })
}
