"use client"

import * as React from "react"
import { FolderPlus, Plus, RefreshCw, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Input } from "@/components/ui/input"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { TooltipProvider } from "@/components/ui/tooltip"

import { AIVentureDisplay } from "./ai-venture-display"
import { AIVentureList } from "./ai-venture-list"
import { NewItemDialog } from "./new-item-dialog"
import { useAIVenture, AIVentureProvider } from "./use-ai-venture"

interface AIVentureAppProps {
  defaultLayout?: number[]
  navCollapsedSize: number
}

function AIVentureAppInner({ defaultLayout = [40, 60] }: AIVentureAppProps) {
  const { loading, searchQuery, setSearchQuery, sortBy, setSortBy, typeFilter, setTypeFilter, breadcrumbs, navigateTo, refresh } =
    useAIVenture()
  const [newItemOpen, setNewItemOpen] = React.useState(false)

  return (
    <TooltipProvider delay={0}>
      <ResizablePanelGroup
        orientation="horizontal"
        onLayoutChanged={(layout) => {
          document.cookie = `react-resizable-panels:layout:ai-venture=${JSON.stringify([layout.list, layout.display])}`
        }}
        className="h-full max-h-[800px] items-stretch"
      >
        <ResizablePanel id="list" defaultSize={defaultLayout[0]} minSize={30}>
          <div className="flex items-center gap-2 px-4 py-2">
            <Breadcrumb className="flex-1 min-w-0">
              <BreadcrumbList className="flex-nowrap overflow-hidden">
                {breadcrumbs.map((crumb, i) => (
                  <React.Fragment key={crumb.path || "root"}>
                    {i > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem className="min-w-0">
                      {i === breadcrumbs.length - 1 ? (
                        <BreadcrumbPage className="line-clamp-1">{crumb.name}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <button onClick={() => navigateTo(crumb.path)} className="line-clamp-1">
                            {crumb.name}
                          </button>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
            <Button variant="ghost" size="icon" className="size-8 shrink-0" title="New file" onClick={() => setNewItemOpen(true)}>
              <Plus className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              title="Refresh"
              onClick={refresh}
              disabled={loading}
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            </Button>
          </div>
          <Separator />
          <div className="flex flex-col gap-2 bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search this folder..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="h-8 flex-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="modified">Last modified</SelectItem>
                  <SelectItem value="size">Size</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
                <SelectTrigger className="h-8 flex-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="md">Markdown</SelectItem>
                  <SelectItem value="txt">Text</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <AIVentureList />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel id="display" defaultSize={defaultLayout[1]} minSize={30}>
          <AIVentureDisplay />
        </ResizablePanel>
      </ResizablePanelGroup>

      <NewItemDialog open={newItemOpen} onOpenChange={setNewItemOpen} />
    </TooltipProvider>
  )
}

export function AIVentureApp(props: AIVentureAppProps) {
  return (
    <AIVentureProvider>
      <AIVentureAppInner {...props} />
    </AIVentureProvider>
  )
}
