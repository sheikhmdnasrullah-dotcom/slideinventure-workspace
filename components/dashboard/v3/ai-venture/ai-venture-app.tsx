"use client"

import * as React from "react"
import Link from "next/link"
import {
  Beaker,
  Brain,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Rocket,
  Search,
  Sparkles,
  Upload,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SectionErrorBoundary } from "@/components/system/error-boundary"
import { ResearchLabApp } from "@/components/dashboard/v3/research-lab/research-lab-app"

import { SketchesPanel, type SketchBoard } from "./sketches-panel"
import { IdeasPanel, type Idea } from "./ideas-panel"
import { PdfPanel, type VenturePdf } from "./pdf-panel"
import { RecentList } from "./recent-list"

type VentureNode = {
  id: string
  path: string
  name: string
  type: "file" | "folder"
  ext: string | null
  size: number
  modifiedAt: string
  children?: VentureNode[]
}

type Tab = "overview" | "sketches" | "ideas" | "pdf"

type SearchHit = { type: "sketch" | "idea" | "pdf" | "research"; id: string; title: string; snippet: string; updatedAt: string }

const TYPE_LABEL: Record<SearchHit["type"], string> = {
  sketch: "Sketch",
  idea: "Idea",
  pdf: "PDF",
  research: "Research",
}

function AIVentureAppInner() {
  const [tab, setTab] = React.useState<Tab>("overview")
  const [boards, setBoards] = React.useState<SketchBoard[]>([])
  const [ideas, setIdeas] = React.useState<Idea[]>([])
  const [pdfs, setPdfs] = React.useState<VenturePdf[]>([])
  const [loading, setLoading] = React.useState(true)
  const [researchOpen, setResearchOpen] = React.useState(false)

  const [search, setSearch] = React.useState("")
  const [searchResults, setSearchResults] = React.useState<SearchHit[] | null>(null)
  const [searching, setSearching] = React.useState(false)
  const searchTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const loadAll = React.useCallback(async () => {
    try {
      const [boardsRes, notesRes, treeRes] = await Promise.all([
        fetch("/api/boards?scope=ai-venture"),
        fetch("/api/notes?scope=ai-venture"),
        fetch("/api/ai-venture"),
      ])
      const boardsData = await boardsRes.json()
      const notesData = await notesRes.json()
      const treeData = await treeRes.json()

      setBoards(boardsData.boards ?? [])
      setIdeas(notesData.notes ?? [])

      const root = treeData.tree as VentureNode | undefined
      const pdfFolder = root?.children?.find((n) => n.name === "PDF" && n.type === "folder")
      const pdfNodes = (pdfFolder?.children ?? []).filter((n) => n.type === "file" && n.ext === ".pdf")
      setPdfs(
        pdfNodes.map((n) => ({
          id: n.id,
          path: n.path,
          name: n.name,
          size: n.size,
          modifiedAt: n.modifiedAt,
        }))
      )
    } catch {
      toast.error("Failed to load AI Venture")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadAll()
  }, [loadAll])

  React.useEffect(() => {
    clearTimeout(searchTimer.current)
    if (!search.trim()) {
      setSearchResults(null)
      return
    }
    setSearching(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ai-venture/search?q=${encodeURIComponent(search.trim())}`)
        const data = await res.json()
        setSearchResults(data.results ?? [])
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [search])

  const createSketch = async () => {
    setTab("sketches")
  }
  const createIdea = () => setTab("ideas")
  const uploadPdf = () => setTab("pdf")

  const hasAnything = boards.length > 0 || ideas.length > 0 || pdfs.length > 0

  const jumpToResult = (hit: SearchHit) => {
    setSearch("")
    setSearchResults(null)
    if (hit.type === "sketch") setTab("sketches")
    else if (hit.type === "idea") setTab("ideas")
    else if (hit.type === "pdf") setTab("pdf")
    else setResearchOpen(true)
  }

  return (
    <TooltipProvider delay={0}>
      <div className="flex h-full flex-col">
        <div className="flex flex-col gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-3">
            <Rocket className="size-5 text-[var(--text-accent)]" />
            <h1 className="text-lg font-semibold">AI Venture</h1>
            <div className="relative ml-4 max-w-md flex-1">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search everything…"
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {searching && <Loader2 className="absolute right-2.5 top-2.5 size-4 animate-spin text-muted-foreground" />}
              {searchResults !== null && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border bg-popover p-1 shadow-md">
                  {searchResults.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">No matches.</p>
                  ) : (
                    searchResults.map((hit) => (
                      <button
                        key={`${hit.type}-${hit.id}`}
                        onClick={() => jumpToResult(hit)}
                        className="flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left text-sm hover:bg-accent/40"
                      >
                        <span className="flex items-center gap-2">
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                            {TYPE_LABEL[hit.type]}
                          </span>
                          <span className="truncate font-medium">{hit.title}</span>
                        </span>
                        {hit.snippet && <span className="truncate pl-0.5 text-xs text-muted-foreground">{hit.snippet}</span>}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setResearchOpen(true)}>
              <Beaker className="size-4" /> Research Lab
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button size="sm" className="gap-1.5"><Plus className="size-4" /> New</Button>} />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={createSketch}>
                  <Pencil className="mr-2 size-4" /> New Sketch
                </DropdownMenuItem>
                <DropdownMenuItem onClick={createIdea}>
                  <FileText className="mr-2 size-4" /> New Idea
                </DropdownMenuItem>
                <DropdownMenuItem onClick={uploadPdf}>
                  <Upload className="mr-2 size-4" /> Upload PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center gap-1 text-sm">
            {(["overview", "sketches", "ideas", "pdf"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1.5 capitalize transition-colors ${
                  tab === t ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/40"
                }`}
              >
                {t === "pdf" ? "PDFs" : t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {tab === "overview" && (
            <div className="flex flex-col gap-8">
              {!loading && !hasAnything ? (
                <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
                  <Brain className="size-10 text-muted-foreground/40" />
                  <div>
                    <p className="text-base font-medium">Start exploring.</p>
                    <p className="text-sm text-muted-foreground">
                      Think freely. Draw, write, collect research, and build your next idea.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button className="gap-1.5" onClick={createSketch}>
                      <Pencil className="size-4" /> New Sketch
                    </Button>
                    <Button variant="outline" className="gap-1.5" onClick={createIdea}>
                      <FileText className="size-4" /> New Idea
                    </Button>
                    <Button variant="outline" className="gap-1.5" onClick={uploadPdf}>
                      <Upload className="size-4" /> Upload PDF
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Card className="cursor-pointer transition-colors hover:bg-accent/30" onClick={() => setTab("sketches")}>
                      <CardContent className="flex flex-col gap-2 p-5">
                        <Sparkles className="size-5 text-[var(--text-accent)]" />
                        <p className="font-medium">Sketches</p>
                        <p className="text-sm text-muted-foreground">{boards.length} board{boards.length === 1 ? "" : "s"}</p>
                      </CardContent>
                    </Card>
                    <Card className="cursor-pointer transition-colors hover:bg-accent/30" onClick={() => setTab("ideas")}>
                      <CardContent className="flex flex-col gap-2 p-5">
                        <Brain className="size-5 text-[var(--text-accent)]" />
                        <p className="font-medium">Ideas</p>
                        <p className="text-sm text-muted-foreground">{ideas.length} idea{ideas.length === 1 ? "" : "s"}</p>
                      </CardContent>
                    </Card>
                    <Card className="cursor-pointer transition-colors hover:bg-accent/30" onClick={() => setTab("pdf")}>
                      <CardContent className="flex flex-col gap-2 p-5">
                        <FileText className="size-5 text-[var(--text-accent)]" />
                        <p className="font-medium">Research</p>
                        <p className="text-sm text-muted-foreground">{pdfs.length} PDF{pdfs.length === 1 ? "" : "s"}</p>
                      </CardContent>
                    </Card>
                  </div>
                  <div>
                    <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Recent</h2>
                    <RecentList />
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "sketches" && <SketchesPanel boards={boards} loading={loading} onChanged={loadAll} />}
          {tab === "ideas" && <IdeasPanel ideas={ideas} loading={loading} onChanged={loadAll} />}
          {tab === "pdf" && <PdfPanel pdfs={pdfs} loading={loading} onChanged={loadAll} />}
        </div>
      </div>

      <Dialog open={researchOpen} onOpenChange={setResearchOpen}>
        <DialogContent className="h-[90vh] max-h-[90vh] w-[95vw] max-w-[1200px] overflow-hidden p-0">
          <ResearchLabApp scope="ai-venture" />
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}

export function AIVentureApp(_props: { defaultLayout?: number[]; navCollapsedSize?: number }) {
  return (
    <SectionErrorBoundary label="AI Venture">
      <AIVentureAppInner />
    </SectionErrorBoundary>
  )
}
