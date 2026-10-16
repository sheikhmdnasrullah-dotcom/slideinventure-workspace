"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { Plus, RefreshCw, Search } from "lucide-react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { commandMenuStore } from "@/lib/command-menu-store"
import { NotificationsBell } from "@/components/dashboard/notifications-bell"
import { LiveWorkStatus } from "@/components/dashboard/live-work-status"

type Crumb = { label: string; href?: string }

export function SiteHeader({
  crumbs,
  onSync,
  syncing = false,
  primaryAction,
  title,
  subtitle,
}: {
  crumbs?: Crumb[]
  onSync?: () => void
  syncing?: boolean
  primaryAction?: { label: string; href?: string; onClick?: () => void }
  title?: string
  subtitle?: string
}) {
  const pathname = usePathname()
  const resolvedCrumbs = React.useMemo(() => {
    if (crumbs && crumbs.length > 0) return crumbs
    const segments = pathname.split("/").filter(Boolean)
    if (segments.length === 0) return [{ label: "Dashboard" }]
    return [
      { label: "Dashboard", href: "/" },
      ...segments.map((seg, i) => ({
        label: humanize(seg),
        href: "/" + segments.slice(0, i + 1).join("/"),
      })),
    ]
  }, [crumbs, pathname])

  const lastIndex = resolvedCrumbs.length - 1
  const [scrolled, setScrolled] = React.useState(false)
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      data-slot="site-header"
      data-scrolled={scrolled || undefined}
      className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b border-transparent bg-background transition-[border-color] ease-linear data-[scrolled]:border-rule"
    >
      <div className="flex w-full items-center gap-1 px-5 md:gap-2 md:px-10">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-1 data-vertical:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            {resolvedCrumbs.map((crumb, i) => {
              const isLast = i === lastIndex
              return (
                <React.Fragment key={`${crumb.label}-${i}`}>
                  <BreadcrumbItem>
                    {isLast || !crumb.href ? (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink render={<Link href={crumb.href} />}>{crumb.label}</BreadcrumbLink>
                    )}
                 </BreadcrumbItem>
                  {!isLast && <BreadcrumbSeparator />}
               </React.Fragment>
              )
            })}
         </BreadcrumbList>
       </Breadcrumb>
        {subtitle && (
          <span className="hidden truncate font-label text-ink-muted sm:inline">{subtitle}</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <LiveWorkStatus />
          <NotificationsBell />
          <Button
            size="sm"
            variant="outline"
            onClick={() => commandMenuStore.open()}
            className="gap-2 text-ink-muted hidden sm:flex"
            aria-label="Open command menu"
          >
            <Search className="size-4" />
            <span className="hidden sm:inline">Ask · Search</span>
            <kbd className="hidden h-6 items-center rounded-xs border border-rule bg-surface-2 px-1.5 font-sans text-xs text-ink-muted lg:inline-flex">
              ⌘K
           </kbd>
         </Button>
          {onSync && (
            <Button size="sm" variant="outline" onClick={onSync} disabled={syncing}>
              <motion.span
                className="flex items-center"
                animate={syncing ? { rotate: 360 } : { rotate: 0 }}
                transition={syncing ? { repeat: Infinity, duration: 0.8, ease: "linear" } : {}}
              >
                <RefreshCw className="size-4" />
             </motion.span>
              Sync now
           </Button>
          )}
          {primaryAction && (
            <Button
              size="sm"
              className="hidden sm:flex"
              render={
                primaryAction.href ? (
                  <Link href={primaryAction.href} />
                ) : (
                  <button type="button" onClick={primaryAction.onClick} />
                )
              }
            >
              <Plus />
              <span>{primaryAction.label}</span>
           </Button>
          )}
       </div>
     </div>
   </header>
  )
}

function humanize(seg: string) {
  return seg
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
