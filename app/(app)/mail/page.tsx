import { cookies } from "next/headers"
import { requireUser } from "@/lib/supabase/server"

import { SiteHeader } from "@/components/dashboard/site-header"
import { Mail } from "@/components/dashboard/v3/mail/mail"
import { MailProvider } from "@/components/dashboard/v3/mail/use-mail"

export default async function MailPage() {
  await requireUser()

  const cookieStore = await cookies()
  const layout = cookieStore.get("react-resizable-panels:layout:mail")
  const collapsed = cookieStore.get("react-resizable-panels:collapsed")

  const defaultLayout = layout ? JSON.parse(layout.value) : undefined
  const defaultCollapsed = collapsed ? JSON.parse(collapsed.value) : undefined

  return (
    <>
      <SiteHeader crumbs={[{ label: "Mail" }]} />
      <div className="md:hidden p-8 text-center text-muted-foreground">
        Mail isn&apos;t available on small screens yet.
      </div>
      <div className="hidden flex-1 flex-col md:flex">
        <MailProvider>
          <Mail
            defaultLayout={defaultLayout}
            defaultCollapsed={defaultCollapsed}
            navCollapsedSize={4}
          />
        </MailProvider>
      </div>
    </>
  )
}
