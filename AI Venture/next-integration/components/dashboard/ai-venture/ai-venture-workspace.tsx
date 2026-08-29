"use client"

import { useEffect } from "react"
import { useQueryState, parseAsStringLiteral } from "nuqs"
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
  Send,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { SiteHeader } from "@/components/dashboard/site-header"
import { ActiveTabIndicator, TabTransition } from "@/components/system/motion"

const AvFiles = dynamic(() => import("./av-files").then((m) => m.AvFiles), {
  ssr: false,
  loading: () => <Loading label="Files" />,
})
const AvUsefulLinks = dynamic(() => import("./av-useful-links").then((m) => m.AvUsefulLinks), {
  ssr: false,
  loading: () => <Loading label="Useful Links" />,
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
const FoamNotebook = dynamic(
  () => import("@/components/dashboard/ai-venture/foam-notebook").then((m) => m.FoamNotebook),
  { ssr: false, loading: () => <Loading label="Foam Notes" /> }
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
  | "useful-links"
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
  { id: "useful-links", label: "Useful Links", icon: Send, description: "Curated bookmarks and resources for this venture" },
  { id: "query", label: "AI Query", icon: Sparkles, description: "Ask across your knowledge" },
  { id: "brainstorm", label: "Brainstorm", icon: PenTool, description: "Whiteboard and connect ideas visually" },
  { id: "notepad", label: "Notepad", icon: NotebookPen, description: "Free-form notes for this venture" },
  { id: "connected", label: "Connected Ideas", icon: Lightbulb, description: "Idea maps linked across research" },
  { id: "agents", label: "Agents", icon: Bot, description: "Run and monitor AI agents" },
  { id: "activity", label: "Agents Activity", icon: Activity, description: "Live feed of every agent run and section edit" },
]

const SECTION_IDS = ["home", ...SECTIONS.map((s) => s.id)] as SectionId[]

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
  // Shallow URL state: switching section no longer asks the server for a new RSC
  // payload, it just swaps which component is mounted. The previous
  // `router.replace` + `useEffect` sync also meant the URL was the source of
  // truth one render late; `useQueryState` removes that round-trip entirely.
  const [active, setActive] = useQueryState(
    "tab",
    parseAsStringLiteral(SECTION_IDS).withDefault("home")
  )

  // Active 10-second background watcher: automatically summarizes and pushes
  // any updates in Notepad, Brainstorm, Files, or chat into the Research Lab.
  useEffect(() => {
    const triggerSync = () => {
      fetch("/api/research-lab/sync", { method: "POST" }).catch(() => {})
    }

    // Initial sync
    const initial = setTimeout(triggerSync, 1500)
    // Continuous 10-second interval push
    const interval = setInterval(triggerSync, 10_000)

    return () => {
      clearTimeout(initial)
      clearInterval(interval)
    }
  }, [])

  const select = (id: SectionId) => {
    void setActive(id)
    if (id === "research") {
      fetch("/api/research-lab/sync", { method: "POST" }).catch(() => {})
    }
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
              "relative flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-left transition-colors",
              active === "home"
                ? "text-ink-strong"
                : "text-ink-muted hover:bg-[var(--surface-2)]/60 hover:text-ink-strong"
            )}
          >
            {active === "home" && <ActiveTabIndicator />}
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
                    "relative flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-left transition-colors",
                    isActive
                      ? "text-ink-strong"
                      : "text-ink-muted hover:bg-[var(--surface-2)]/60 hover:text-ink-strong"
                  )}
                >
                  {isActive && <ActiveTabIndicator />}
                  <Icon className="size-4 shrink-0" strokeWidth={1.5} />
                  <span className="font-body-tight truncate text-sm">{s.label}</span>
                </button>
              )
            })}
          </div>
        </nav>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <TabTransition tabKey={active} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden h-full">
            {active === "home" && <Launcher onSelect={select} />}
            {active === "files" && <AvFiles />}
            {active === "useful-links" && <AvUsefulLinks />}
            {active === "query" && <AvQuery />}
            {active === "research" && <AvResearch />}
            {active === "playground" && <AvPlayground />}
            {active === "brainstorm" && <AvWhiteboard />}
            {active === "notepad" && <FoamNotebook />}
            {active === "connected" && <IdeaMapsPanel scope="ideas" title="Connected ideas" />}
            {active === "agents" && <AvAgents />}
            {active === "activity" && <AvActivity />}
          </TabTransition>
        </main>
      </div>
    </>
  )
}
