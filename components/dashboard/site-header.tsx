"use client";

import { motion } from "framer-motion";
import { CalendarRange, RefreshCw, Search } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { commandMenuStore } from "@/lib/command-menu-store";

export function SiteHeader({
  title,
  onSync,
  syncing = false,
}: {
  title: string;
  onSync?: () => void;
  syncing?: boolean;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-rule">
      <div className="flex flex-1 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage className="text-sm font-medium text-ink-strong">{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="flex items-center gap-2 px-4">
        {/* ⌘K trigger — the same surface the sidebar exposes, surfaced in the
            top chrome so a user who has collapsed the rail still has an obvious
            way into search/ask/navigate. */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => commandMenuStore.open()}
          className="gap-2 text-ink-muted"
          aria-label="Open command menu"
        >
          <Search className="size-3.5" />
          <span className="hidden sm:inline">Ask · Search</span>
          <kbd className="hidden h-5 items-center rounded-xs border border-rule bg-[var(--surface-2)] px-1 font-mono text-[10px] text-ink-faint md:inline-flex">
            ⌘K
          </kbd>
        </Button>
        <span className="hidden items-center gap-1.5 rounded-md border border-rule px-2.5 py-1.5 font-mono text-xs text-ink-muted sm:flex">
          <CalendarRange className="size-3.5" />
          Aug 1 – Aug 18, 2026
        </span>
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
      </div>
    </header>
  );
}
