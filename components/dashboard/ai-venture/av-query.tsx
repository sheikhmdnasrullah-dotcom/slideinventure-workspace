"use client"

import { useRef, useState } from "react"
import { Loader2, Send, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type Msg = { role: "user" | "assistant"; content: string }

// Reuses the SAME /api/chat endpoint (and its NVIDIA-powered gateway +
// cross-section retrieval over Knowledge/Documents/Notes/Terminal/Links) as
// the main dashboard Chat: no separate/isolated AI system, no new API key.
// AI-Venture-sourced material is reachable here because uploaded files and
// notes are already mirrored into Knowledge by the existing pipeline.
export function AvQuery() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const sessionIdRef = useRef<string | null>(null)

  const ask = async () => {
    const question = input.trim()
    if (!question || busy) return
    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: question }])
    setBusy(true)
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionIdRef.current ?? undefined, message: question }),
      })
      if (!res.body) throw new Error("No response stream")
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let answer = ""
      setMessages((prev) => [...prev, { role: "assistant", content: "" }])
      let buffer = ""
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const event = JSON.parse(line.slice(6))
          if (event.type === "session") sessionIdRef.current = event.sessionId
          if (event.type === "delta") {
            answer += event.content
            setMessages((prev) => {
              const next = [...prev]
              next[next.length - 1] = { role: "assistant", content: answer }
              return next
            })
          }
        }
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Try again." }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <Sparkles className="size-8" />
            <p className="text-sm">Ask anything. This searches your Knowledge, Documents, Notes, Terminal, and Links.</p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm",
                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}
                >
                  {m.content || (busy && i === messages.length - 1 ? <Loader2 className="size-4 animate-spin" /> : "")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-end gap-2 border-t border-border p-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              ask()
            }
          }}
          placeholder="Ask about your AI Venture material…"
          className="min-h-10 flex-1 resize-none text-sm"
        />
        <Button size="icon" onClick={ask} disabled={busy || !input.trim()}>
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  )
}
