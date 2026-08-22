"use client"

import * as React from "react"
import { BookOpen, FileText, Search, Plus, RefreshCw, Layers, FileCode2, LibraryBig } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Separator } from "@/components/ui/separator"
import { TooltipProvider } from "@/components/ui/tooltip"

import { KnowledgeDisplay } from "./knowledge-display"
import { KnowledgeList } from "./knowledge-list"
import { Nav } from "./nav"
import { useKnowledge, KnowledgeProvider } from "./use-knowledge"
import { AddContextDialog } from "./add-context-dialog"

interface KnowledgeAppProps {
  defaultLayout?: number[]
  defaultCollapsed?: boolean
  navCollapsedSize: number
}

function KnowledgeAppInner({
  defaultLayout = [20, 32, 48],
  defaultCollapsed = false,
  navCollapsedSize,
}: KnowledgeAppProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed)
  const {
    loading, searchQuery, setSearchQuery,
    setCategory, category, refresh, setAddOpen, syncFilesystem
  } = useKnowledge()

  return (
    <TooltipProvider delay={0}>
      <ResizablePanelGroup
        orientation="horizontal"
        onLayoutChanged={(layout) => {
          document.cookie = `react-resizable-panels:layout:knowledge=${JSON.stringify(
            [layout.nav, layout.list, layout.display]
          )}`
        }}
        className="h-full max-h-[800px] items-stretch"
      >
        {/* ─── LEFT NAV ─── */}
        <ResizablePanel
          id="nav"
          defaultSize={defaultLayout[0]}
          collapsedSize={navCollapsedSize}
          collapsible={true}
          minSize={15}
          maxSize={20}
          onResize={(panelSize) => {
            const nowCollapsed = panelSize.asPercentage <= navCollapsedSize
            setIsCollapsed(nowCollapsed)
            document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(nowCollapsed)}`
          }}
          className={cn(
            isCollapsed && "min-w-[50px] transition-all duration-300 ease-in-out"
          )}
        >
          <div className="flex h-[52px] items-center justify-center">
            <span className={cn("font-semibold", isCollapsed && "hidden")}>Knowledge Base</span>
            {isCollapsed && <LibraryBig className="h-4 w-4" />}
          </div>
          <Separator />
          {/* Add button */}
          {!isCollapsed && (
            <div className="px-2 py-2">
              <Button
                className="w-full justify-start gap-2"
                size="sm"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Add Context
              </Button>
            </div>
          )}
          {isCollapsed && (
            <div className="flex justify-center py-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
          <Nav
            isCollapsed={isCollapsed}
            links={[
              { title: "All Items", icon: Layers, variant: category === "All" ? "default" : "ghost", onClick: () => setCategory("All") },
              { title: "Notes", icon: FileText, variant: category === "note" ? "default" : "ghost", onClick: () => setCategory("note") },
              { title: "SOPs", icon: BookOpen, variant: category === "sop" ? "default" : "ghost", onClick: () => setCategory("sop") },
              { title: "System Docs", icon: FileCode2, variant: category === "system" ? "default" : "ghost", onClick: () => setCategory("system") },
            ]}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* ─── LIST ─── */}
        <ResizablePanel id="list" defaultSize={defaultLayout[1]} minSize={30}>
          <div className="flex items-center px-4 py-2">
            <h1 className="text-xl font-bold capitalize">
              {category}
            </h1>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto"
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
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search knowledge..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </form>
          </div>
          <KnowledgeList />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* ─── DISPLAY ─── */}
        <ResizablePanel id="display" defaultSize={defaultLayout[2]} minSize={30}>
          <KnowledgeDisplay />
        </ResizablePanel>
      </ResizablePanelGroup>

      <AddContextDialog />
    </TooltipProvider>
  )
}

export function KnowledgeApp(props: KnowledgeAppProps) {
  return (
    <KnowledgeProvider>
      <KnowledgeAppInner {...props} />
    </KnowledgeProvider>
  )
}
