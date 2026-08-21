import { cookies } from "next/headers"

import { SiteHeader } from "@/components/dashboard/site-header"
import { Mail } from "@/components/dashboard/v3/mail/mail"
import { MailProvider } from "@/components/dashboard/v3/mail/use-mail"
import { accounts, mails } from "@/components/dashboard/v3/mail/data"

export default async function MailPage() {
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
            accounts={accounts}
            mails={mails}
            defaultLayout={defaultLayout}
            defaultCollapsed={defaultCollapsed}
            navCollapsedSize={4}
          />
        </MailProvider>
      </div>
    </>
  )
}
