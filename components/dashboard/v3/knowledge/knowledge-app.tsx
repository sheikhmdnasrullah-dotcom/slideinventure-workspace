"use client"

import * as React from "react"
import { BookOpen, FileText, NotebookPen, Plus, RefreshCw, FileCode2, LibraryBig, PanelRightClose, PanelRightOpen, Users } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TooltipProvider } from "@/components/ui/tooltip"

import { KnowledgeList } from "./knowledge-list"
import { KnowledgeDisplay } from "./knowledge-display"
import { AddContextDialog } from "./add-context-dialog"
import { useKnowledge, KnowledgeProvider } from "./use-knowledge"
import { SectionErrorBoundary } from "@/components/system/error-boundary"

const CATEGORIES = [
  { title: "All Items", icon: FileText, cat: "All" },
  { title: "Notes", icon: BookOpen, cat: "note" },
  { title: "SOPs", icon: FileText, cat: "sop" },
  { title: "System Docs", icon: FileCode2, cat: "system" },
  { title: "Prospects & Leads", icon: Users, cat: "research" },
]

function KnowledgeAppInner() {
  const [collapsed, setCollapsed] = React.useState(false)
  const {
    loading, searchQuery, setSearchQuery,
    setCategory, category, setAddOpen, syncFilesystem, createNote
  } = useKnowledge()
  const [creatingNote, setCreatingNote] = React.useState(false)

  const handleNewNote = async () => {
    setCreatingNote(true)
    try {
      await createNote()
    } finally {
      setCreatingNote(false)
    }
  }

  return (
    <TooltipProvider delay={0}>
      <div className="flex h-full overflow-hidden">
        <div
          className={cn(
            "flex h-full flex-col border-r transition-all duration-300",
            collapsed ? "w-[56px]" : "w-[220px]"
          )}
          style={{ borderColor: "var(--rule)" }}
        >
          <div className="flex h-[52px] items-center justify-between px-3">
            {!collapsed && (
              <div className="flex items-center gap-2">
                <LibraryBig className="h-4 w-4 text-[var(--text-accent)]" />
                <span className="font-body-tight text-sm font-semibold text-ink-strong">Knowledge</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
            </Button>
          </div>
          <Separator />
          <div className="flex flex-col gap-1.5 p-2">
            <Button
              className={cn("w-full justify-start gap-2", collapsed && "justify-center px-0")}
              size="sm"
              onClick={handleNewNote}
              disabled={creatingNote}
              title="New Note"
            >
              <NotebookPen className="h-4 w-4" />
              {!collapsed && <span>{creatingNote ? "Creating..." : "New Note"}</span>}
            </Button>
            <Button
              variant="outline"
              className={cn("w-full justify-start gap-2", collapsed && "justify-center px-0")}
              size="sm"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-4 w-4" />
              {!collapsed && <span>Add Context</span>}
            </Button>
          </div>
          <nav className="flex flex-col gap-1 px-2 py-2">
            {CATEGORIES.map((item) => (
              <Button
                key={item.cat}
                variant={category === item.cat ? "default" : "ghost"}
                className={cn("justify-start gap-2", collapsed && "justify-center px-2")}
                size="sm"
                onClick={() => setCategory(item.cat)}
              >
                <item.icon className="h-4 w-4" />
                {!collapsed && <span className="text-sm">{item.title}</span>}
              </Button>
            ))}
          </nav>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3">
            <h1 className="font-display-soft text-lg capitalize text-ink-strong">{category}</h1>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-8 w-8"
              onClick={syncFilesystem}
              disabled={loading}
              title="Sync from Filesystem"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
          <Separator />
          <div className="bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <form onSubmit={(e) => e.preventDefault()}>
              <div className="relative">
                <FileText className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search knowledge..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </form>
          </div>
          <ScrollArea className="flex-1">
            <KnowledgeList />
          </ScrollArea>
        </div>

        <KnowledgeDetailSheet />
        <AddContextDialog />
      </div>
    </TooltipProvider>
  )
}

function KnowledgeDetailSheet() {
  const { selected, setSelected, selectedItem } = useKnowledge()

  return (
    <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
      <SheetContent className="w-full overflow-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{selectedItem?.title || "Detail"}</SheetTitle>
        </SheetHeader>
        <KnowledgeDisplay />
      </SheetContent>
    </Sheet>
  )
}

export function KnowledgeApp(_props: KnowledgeAppProps) {
  return (
    <SectionErrorBoundary label="Knowledge">
      <KnowledgeProvider>
        <KnowledgeAppInner />
      </KnowledgeProvider>
    </SectionErrorBoundary>
  )
}

interface KnowledgeAppProps {
  navCollapsedSize?: number
}
