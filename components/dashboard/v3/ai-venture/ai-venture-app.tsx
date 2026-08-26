"use client"

import * as React from "react"
import { Brain, FileUp, Plus, RefreshCw, Search } from "lucide-react"

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
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { TooltipProvider } from "@/components/ui/tooltip"
import { toast } from "sonner"

import { AIVentureDisplay } from "./ai-venture-display"
import { AIVentureList } from "./ai-venture-list"
import { NewItemDialog } from "./new-item-dialog"
import { useAIVenture, AIVentureProvider } from "./use-ai-venture"
import { SectionErrorBoundary } from "@/components/system/error-boundary"

interface AIVentureAppProps {
  defaultLayout?: number[]
  navCollapsedSize: number
}

function AIVentureAppInner({ }: AIVentureAppProps) {
  const { loading, searchQuery, setSearchQuery, sortBy, setSortBy, typeFilter, setTypeFilter, breadcrumbs, navigateTo, refresh, startBrainstorm, uploadPdf, selectedFile, brainstormOpen, closeViewer } =
    useAIVenture()
  const [newItemOpen, setNewItemOpen] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    try {
      await uploadPdf(file)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload PDF")
    }
  }

  const viewerOpen = !!selectedFile || brainstormOpen

  return (
    <TooltipProvider delay={0}>
      <div className="flex h-full flex-col">
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
                      <BreadcrumbLink
                        render={<button type="button" onClick={() => navigateTo(crumb.path)} />}
                        className="line-clamp-1"
                      >
                        {crumb.name}
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
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-[var(--text-accent)]"
            title="New brainstorm"
            onClick={startBrainstorm}
          >
            <Brain className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            title="Upload PDF"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp className="size-4" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleUploadPdf}
          />
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
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="brainstorm">Brainstorms</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <AIVentureList />
      </div>

      <Dialog open={viewerOpen} onOpenChange={(o) => { if (!o) closeViewer() }}>
        <DialogContent className="h-[90vh] max-h-[90vh] w-[95vw] max-w-[1100px] overflow-hidden p-0">
          <AIVentureDisplay />
        </DialogContent>
      </Dialog>

      <NewItemDialog open={newItemOpen} onOpenChange={setNewItemOpen} />
    </TooltipProvider>
  )
}

export function AIVentureApp(props: AIVentureAppProps) {
  return (
    <SectionErrorBoundary label="AI Venture">
      <AIVentureProvider>
        <AIVentureAppInner {...props} />
      </AIVentureProvider>
    </SectionErrorBoundary>
  )
}
