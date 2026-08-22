import { cookies } from "next/headers"
import { requireUser } from "@/lib/supabase/server"

import { SiteHeader } from "@/components/dashboard/site-header"
import { Mail } from "@/components/dashboard/v3/mail/mail"
import { MailProvider } from "@/components/dashboard/v3/mail/use-mail"

export default async function MailPage() {
  await requireUser()

  const cookieStore = await cookies()
  const layout = cookieStore.get("mail-panel-layout")
  const collapsed = cookieStore.get("mail-panel-collapsed")

  const defaultLayout = tryParseLayout(layout?.value)

  return (
    <>
      <SiteHeader crumbs={[{ label: "Mail" }]} />
      <div className="flex h-[calc(100vh-theme(spacing.16))] flex-col p-4">
        <MailProvider>
          <Mail
            defaultLayout={defaultLayout}
            navCollapsedSize={0}
          />
        </MailProvider>
      </div>
    </>
  )
}

function tryParseLayout(value: string | undefined): number[] | undefined {
  if (!value) return undefined
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed) && parsed.length === 3 && parsed.every((n) => Number.isFinite(n))) {
      return parsed
    }
  } catch {
    // corrupted cookie — fall back to the component's own default
  }
  return undefined
}
