"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Bot, Send, Loader2, X, FileCode2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useLiveEvents } from "@/components/providers/event-stream"
import { agentStatusLabel } from "@/lib/agui/protocol"
import type { DomainEvent } from "@/lib/events/types"

type Agent = {
  slug: string
  name: string
  description: string
  division: string
  team: string | null
  emoji: string | null
  color: string | null
}

type Msg = { role: "user" | "assistant"; content: string }

// Talks to one installed agent persona (`.claude/agents/<slug>.md`). The roster
// can legitimately be empty; in that case we say so plainly rather than invent
// personas. While a run is in flight we show only its execution status from the
// live event stream, never the agent's reasoning.
export function AvAgents() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Agent | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [history, setHistory] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string>("")
  const [answer, setAnswer] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tools, setTools] = useState(false)

  const currentRunId = useRef<string | null>(null)
  const historyRef = useRef<Msg[]>([])

  useEffect(() => {
    historyRef.current = history
  }, [history])

  const loadAgents = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch("/api/agents")
      if (!res.ok) throw new Error("Could not load agents")
      const json = await res.json()
      setAgents(json.agents ?? [])
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load agents")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAgents()
  }, [loadAgents])

  const { events } = useLiveEvents({ types: ["agent."] })

  const runEvent = events.find(
    (e) => (e.metadata?.runId as string | undefined) === currentRunId.current
  )

  useEffect(() => {
    if (!runEvent) return
    setStatus(agentStatusLabel(runEvent.type, runEvent.metadata))
    if (runEvent.type === "agent.completed") setBusy(false)
    if (runEvent.type === "agent.failed") setBusy(false)
  }, [runEvent])

  const selectAgent = (agent: Agent) => {
    setSelected(agent)
    setMessages([])
    setHistory([])
    setAnswer(null)
    setError(null)
    setStatus("")
    setBusy(false)
    currentRunId.current = null
  }

  const send = async () => {
    const text = input.trim()
    if (!text || !selected || busy) return
    setInput("")
    setError(null)
    setAnswer(null)
    setStatus("Working")
    setBusy(true)

    const userMsg: Msg = { role: "user", content: text }
    setMessages((m) => [...m, userMsg])
    setHistory((h) => [...h, userMsg])

    try {
      const res = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: selected.slug,
          message: text,
          history: historyRef.current,
          tools,
        }),
      })
      if (res.status === 503) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || "No LLM provider is configured for this workspace.")
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || "The agent request failed.")
      }
      const json = await res.json()
      currentRunId.current = json.runId ?? null
      const ans = json.answer ?? ""
      setAnswer(ans)
      setMessages((m) => [...m, { role: "assistant", content: ans }])
      setHistory((h) => [...h, { role: "assistant", content: ans }])
    } catch (e) {
      const msg = e instanceof Error ? e.message : "The agent request failed."
      setError(msg)
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-64 shrink-0 flex-col gap-1 border-r border-border bg-card/40 p-2">
        <div className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Agents
        </div>
        <ScrollArea className="flex-1" data-lenis-prevent>
          {loading ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">Loading</p>
          ) : loadError ? (
            <div className="flex flex-col gap-2 px-2 py-3">
              <p className="text-xs text-destructive">{loadError}</p>
              <Button size="xs" variant="outline" onClick={loadAgents}>
                Retry
              </Button>
            </div>
          ) : agents.length === 0 ? (
            <div className="flex flex-col gap-2 px-2 py-3">
              <p className="text-xs text-muted-foreground">
                No agents are installed. Personas come from agent files in{" "}
                <code className="rounded bg-muted px-1">.claude/agents/*.md</code>. Add one and it
                shows up here.
              </p>
            </div>
          ) : (
            agents.map((a) => (
              <button
                key={a.slug}
                onClick={() => selectAgent(a)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent",
                  selected?.slug === a.slug && "bg-accent"
                )}
              >
                <Bot className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{a.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {a.description || a.division}
                  </span>
                </span>
              </button>
            ))
          )}
        </ScrollArea>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        {!selected ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <FileCode2 className="size-8" />
            <p className="text-sm">
              {agents.length === 0
                ? "No agents installed yet."
                : "Select an agent to send it a message."}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-border px-4 py-2">
              <span className="text-sm font-medium">{selected.name}</span>
              <span className="text-xs text-muted-foreground">{selected.division}</span>
              <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={tools}
                  onChange={(e) => setTools(e.target.checked)}
                  className="size-3.5"
                />
                Enable tools
              </label>
            </div>

            <div className="flex-1 overflow-y-auto p-4" data-lenis-prevent>
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ask {selected.name} anything. Your message is sent with the running conversation.
                </p>
              ) : (
                <div className="mx-auto flex max-w-2xl flex-col gap-3">
                  {messages.map((m, i) => (
                    <div
                      key={i}
                      className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm",
                          m.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        {m.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {status && (
                <div className="mx-auto mt-3 flex max-w-2xl items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className={cn("size-3", busy && "animate-spin")} />
                  {status}
                </div>
              )}
              {error && (
                <p className="mx-auto mt-3 max-w-2xl text-sm text-destructive">{error}</p>
              )}
            </div>

            <div className="flex items-end gap-2 border-t border-border p-3">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
                placeholder={`Message ${selected.name}`}
                className="min-h-10 flex-1 resize-none text-sm"
              />
              <Button size="icon" onClick={send} disabled={busy || !input.trim()}>
                <Send className="size-4" />
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
