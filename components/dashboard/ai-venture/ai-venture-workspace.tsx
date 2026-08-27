"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import {
  FolderOpen,
  Sparkles,
  FlaskConical,
  LayoutGrid,
  LayoutDashboard,
  PenTool,
  NotebookPen,
  Lightbulb,
  Bot,
  Activity,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { SiteHeader } from "@/components/dashboard/site-header"

const AvFiles = dynamic(() => import("./av-files").then((m) => m.AvFiles), {
  ssr: false,
  loading: () => <Loading label="Files" />,
})
const AvQuery = dynamic(() => import("./av-query").then((m) => m.AvQuery), {
  ssr: false,
  loading: () => <Loading label="Query" />,
})
const AvResearch = dynamic(() => import("./av-research").then((m) => m.AvResearch), {
  ssr: false,
  loading: () => <Loading label="Research" />,
})
const AvPlayground = dynamic(() => import("./av-playground").then((m) => m.AvPlayground), {
  ssr: false,
  loading: () => <Loading label="Playground" />,
})
const AvWhiteboard = dynamic(() => import("./av-whiteboard").then((m) => m.AvWhiteboard), {
  ssr: false,
  loading: () => <Loading label="Brainstorm" />,
})
const NotepadView = dynamic(
  () => import("@/components/dashboard/notepad-view").then((m) => m.NotepadView),
  { ssr: false, loading: () => <Loading label="Notepad" /> }
)
const IdeaMapsPanel = dynamic(
  () => import("@/components/dashboard/ideas/idea-maps-panel").then((m) => m.IdeaMapsPanel),
  { ssr: false, loading: () => <Loading label="Connected Ideas" /> }
)
const AvAgents = dynamic(() => import("./av-agents").then((m) => m.AvAgents), {
  ssr: false,
  loading: () => <Loading label="Agents" />,
})
const AvActivity = dynamic(() => import("./av-activity").then((m) => m.AvActivity), {
  ssr: false,
  loading: () => <Loading label="Activity" />,
})

type SectionId =
  | "home"
  | "files"
  | "query"
  | "research"
  | "playground"
  | "brainstorm"
  | "notepad"
  | "connected"
  | "agents"
  | "activity"

const SECTIONS: { id: SectionId; label: string; icon: LucideIcon; description: string }[] = [
  { id: "research", label: "Research Lab", icon: FlaskConical, description: "Investigate and gather sources" },
  { id: "playground", label: "Playground", icon: LayoutGrid, description: "Experiment with prompts and models" },
  { id: "files", label: "Files", icon: FolderOpen, description: "Uploads and generated files" },
  { id: "query", label: "AI Query", icon: Sparkles, description: "Ask across your knowledge" },
  { id: "brainstorm", label: "Brainstorm", icon: PenTool, description: "Whiteboard and connect ideas visually" },
  { id: "notepad", label: "Notepad", icon: NotebookPen, description: "Free-form notes for this venture" },
  { id: "connected", label: "Connected Ideas", icon: Lightbulb, description: "Idea maps linked across research" },
  { id: "agents", label: "Agents", icon: Bot, description: "Run and monitor AI agents" },
  { id: "activity", label: "Activity", icon: Activity, description: "Recent activity in this venture" },
]

const VALID = new Set<SectionId>(["home", ...SECTIONS.map((s) => s.id)])

function Loading({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center font-body text-sm text-ink-muted">
      Loading {label}
    </div>
  )
}

function Launcher({ onSelect }: { onSelect: (id: SectionId) => void }) {
  return (
    <div className="flex-1 overflow-y-auto p-8" data-lenis-prevent>
      <div className="mx-auto flex max-w-3xl flex-col gap-1 pb-6">
        <h2 className="font-display text-xl text-ink-strong">AI Venture</h2>
        <p className="font-body text-sm text-ink-muted">
          One workspace for this venture. Pick a tool to get to work.
        </p>
      </div>
      <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3">
        {SECTIONS.map((s) => {
          const Icon = s.icon
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className="motion-card flex flex-col items-start gap-3 rounded-md border border-rule bg-[var(--surface)] p-4 text-left"
            >
              <span className="flex size-9 items-center justify-center rounded-sm bg-[var(--surface-2)] text-ink-strong">
                <Icon className="size-4.5" strokeWidth={1.5} />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="font-body-tight text-sm font-medium text-ink-strong">{s.label}</span>
                <span className="font-body text-xs text-ink-muted">{s.description}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// One workspace for this venture: a persistent rail on the left selects which
// section is mounted (only the active one mounts). The active section is
// reflected in the URL (?tab=) so a refresh or a shared link restores it.
// The rail's own "Home" entry lands on a launcher grid of the same tools.
export function AiVentureWorkspace() {
  const router = useRouter()
  const params = useSearchParams()
  const tabParam = params.get("tab")

  const [active, setActive] = useState<SectionId>("home")

  useEffect(() => {
    if (tabParam && VALID.has(tabParam as SectionId)) {
      setActive(tabParam as SectionId)
    }
  }, [tabParam])

  const select = (id: SectionId) => {
    setActive(id)
    const q = new URLSearchParams(Array.from(params.entries()))
    q.set("tab", id)
    router.replace(`/concepts?${q.toString()}`, { scroll: false })
  }

  return (
    <>
      <SiteHeader crumbs={[{ label: "AI Venture" }]} subtitle="Workspace" />
      <div className="flex h-[calc(100vh-var(--header-height))] w-full overflow-hidden">
        <nav className="flex w-48 shrink-0 flex-col gap-1 border-r border-rule bg-[var(--surface-2)]/40 p-2">
          <button
            onClick={() => select("home")}
            aria-current={active === "home" ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-left transition-colors",
              active === "home"
                ? "bg-[var(--surface-2)] text-ink-strong"
                : "text-ink-muted hover:bg-[var(--surface-2)]/60 hover:text-ink-strong"
            )}
          >
            <LayoutDashboard className="size-4 shrink-0" strokeWidth={1.5} />
            <span className="font-body-tight text-sm">Home</span>
          </button>
          <div className="my-1 h-px bg-rule" />
          <div className="flex flex-col gap-0.5 overflow-y-auto" data-lenis-prevent>
            {SECTIONS.map((s) => {
              const Icon = s.icon
              const isActive = active === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => select(s.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-left transition-colors",
                    isActive
                      ? "bg-[var(--surface-2)] text-ink-strong"
                      : "text-ink-muted hover:bg-[var(--surface-2)]/60 hover:text-ink-strong"
                  )}
                >
                  <Icon className="size-4 shrink-0" strokeWidth={1.5} />
                  <span className="font-body-tight truncate text-sm">{s.label}</span>
                </button>
              )
            })}
          </div>
        </nav>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {active === "home" && <Launcher onSelect={select} />}
          {active === "files" && <AvFiles />}
          {active === "query" && <AvQuery />}
          {active === "research" && <AvResearch />}
          {active === "playground" && <AvPlayground />}
          {active === "brainstorm" && <AvWhiteboard />}
          {active === "notepad" && <NotepadView scope="ai-venture" />}
          {active === "connected" && <IdeaMapsPanel scope="ideas" title="Connected ideas" />}
          {active === "agents" && <AvAgents />}
          {active === "activity" && <AvActivity />}
        </main>
      </div>
    </>
  )
}
