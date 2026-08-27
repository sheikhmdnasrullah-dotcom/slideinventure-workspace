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

  return (
    <header className="sticky top-0 z-10 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/90 transition-[width,height] ease-linear backdrop-blur-sm group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
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
                      <BreadcrumbPage className="text-base font-medium">{crumb.label}</BreadcrumbPage>
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
          <span className="hidden truncate font-label text-ink-faint sm:inline">{subtitle}</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <NotificationsBell />
          <Button
            size="sm"
            variant="outline"
            onClick={() => commandMenuStore.open()}
            className="gap-2 text-muted-foreground hidden sm:flex"
            aria-label="Open command menu"
          >
            <Search className="size-3.5" />
            <span className="hidden sm:inline">Ask · Search</span>
            <kbd className="hidden h-5 items-center rounded-xs border border-border bg-muted px-1 font-mono text-[10px] text-muted-foreground md:inline-flex">
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
                <RefreshCw className="size-3.5" />
             </motion.span>
              Sync now
           </Button>
          )}
          {primaryAction && (
            <Button
              size="sm"
              className="hidden h-7 sm:flex"
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
