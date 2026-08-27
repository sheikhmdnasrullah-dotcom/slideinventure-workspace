"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import {
  FolderOpen,
  Sparkles,
  FlaskConical,
  LayoutGrid,
  PenTool,
  NotebookPen,
  Lightbulb,
  Bot,
  Activity,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

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
  | "files"
  | "query"
  | "research"
  | "playground"
  | "brainstorm"
  | "notepad"
  | "connected"
  | "agents"
  | "activity"

const SECTIONS: { id: SectionId; label: string; icon: LucideIcon }[] = [
  { id: "files", label: "Files", icon: FolderOpen },
  { id: "query", label: "Query", icon: Sparkles },
  { id: "research", label: "Research", icon: FlaskConical },
  { id: "playground", label: "Playground", icon: LayoutGrid },
  { id: "brainstorm", label: "Brainstorm", icon: PenTool },
  { id: "notepad", label: "Notepad", icon: NotebookPen },
  { id: "connected", label: "Connected Ideas", icon: Lightbulb },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "activity", label: "Activity", icon: Activity },
]

const VALID = new Set(SECTIONS.map((s) => s.id))

function Loading({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading {label}
    </div>
  )
}

// One workspace for this venture: a persistent rail on the left selects which
// section is mounted (only the active one mounts). The active section is
// reflected in the URL (?tab=) so a refresh or a shared link restores it.
export function AiVentureWorkspace() {
  const router = useRouter()
  const params = useSearchParams()
  const tabParam = params.get("tab")

  const [active, setActive] = useState<SectionId>("research")

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
    <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden">
      <nav className="flex w-44 shrink-0 flex-col gap-1 border-r border-border bg-card/40 p-2">
        <div className="px-2 py-2">
          <h1 className="text-sm font-semibold tracking-tight">AI Venture</h1>
        </div>
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
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                  isActive
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" strokeWidth={1.5} />
                <span className="truncate">{s.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
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
  )
}
