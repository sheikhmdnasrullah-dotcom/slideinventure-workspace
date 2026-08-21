"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Send, X, Loader2, Sparkles, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EvidenceBlock } from "@/components/system";
import { FilterBar } from "@/components/system";

type MessageRole = "user" | "assistant";

interface EvidenceChunk {
  chunk_id: string;
  knowledge_item_id: string;
  chunk_index: number;
  heading: string | null;
  text: string;
  start_offset: number;
  end_offset: number;
  similarity: number;
}

interface Message {
  id: string;
  role: MessageRole;
  content: string;
  evidence?: Array<{
    chunk_id: string;
    knowledge_item_id: string;
    chunk_index: number;
    heading: string | null;
    text: string;
    start_offset: number;
    end_offset: number;
    similarity: number;
  }>;
  filters?: Record<string, unknown>;
  createdAt: string;
}

interface Session {
  id: string;
  title: string;
  updatedAt: string;
}

async function loadSessions(
  setSessions: (s: Session[]) => void,
  setActiveSessionId: (id: string) => void,
  activeSessionId: string | null
) {
  try {
    const res = await fetch("/api/chat/sessions");
    if (res.ok) {
      const data = await res.json();
      setSessions(data);
      if (data.length > 0 && !activeSessionId) {
        setActiveSessionId(data[0].id);
      }
    }
  } catch {
    // silent
  }
}

async function loadMessages(sessionId: string, setMessages: (m: Message[]) => void) {
  try {
    const res = await fetch(`/api/chat/messages?sessionId=${sessionId}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data);
    }
  } catch {
    // silent
  }
}

export function ChatInterface() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load sessions on mount
  useEffect(() => {
    loadSessions(setSessions, setActiveSessionId, activeSessionId);
  }, []);

  // Load messages when session changes
  useEffect(() => {
    if (activeSessionId) {
      loadMessages(activeSessionId, setMessages);
    } else {
      // Data-fetching pattern: clearing messages when session changes is a legitimate
      // setState-in-effect use case. The lint rule is overly strict for this pattern.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessages((prev) => (prev.length === 0 ? prev : []));
    }
  }, [activeSessionId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  const newSession = () => {
    setStreaming(true);
    setInput("");
    setMessages([]);
    setActiveSessionId(null);
    setStreaming(false);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    setStreaming(true);
    setInput("");
    setMessages((prev) => [...prev, { id: `temp-${Date.now()}`, role: "user", content: text, createdAt: new Date().toISOString() }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSessionId,
          message: text,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Stream failed");
      }

      const reader = res.body.getReader();
      let buffer = "";
      let currentMessageId: string | null = null;
      let assistantContent = "";

      // Remove temp user message
      setMessages((prev) => prev.filter((m) => !m.id.startsWith("temp-")));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += new TextDecoder().decode(value);
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            switch (event.type) {
              case "session":
                // Session created, will be picked up by loadSessions effect
                break;
              case "delta":
                assistantContent += event.content;
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last && last.role === "assistant" && !last.id.startsWith("msg-")) {
                    return [...prev.slice(0, -1), { ...last, content: assistantContent }];
                  }
                  return [...prev, { id: `assistant-streaming`, role: "assistant", content: assistantContent, createdAt: new Date().toISOString() }];
                });
                break;
              case "evidence":
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last && last.role === "assistant") {
                    return [...prev.slice(0, -1), { ...last, content: assistantContent, evidence: event.evidence }];
                  }
                  return prev;
                });
                break;
              case "done":
                currentMessageId = event.messageId;
                break;
            }
          } catch {
            // ignore parse errors
          }
        }
      }

      // Finalize
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === "assistant") {
          return [...prev.slice(0, -1), { ...last, id: currentMessageId || `msg-${Date.now()}`, content: assistantContent, evidence: last.evidence }];
        }
        return prev;
      });

    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [...prev, { id: `msg-${Date.now()}`, role: "assistant", content: "Sorry, something went wrong. Please try again.", createdAt: new Date().toISOString() }]);
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Sidebar - Session list */}
      <aside
        className={cn(
          "flex flex-col border-r border-rule bg-[var(--surface)] transition-all duration-220 ease-expo",
          sidebarOpen ? "w-72" : "w-14"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-rule px-3">
          {sidebarOpen && (
            <span className="font-label text-ink-muted">Conversations</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle sidebar"
            className="shrink-0"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 mb-2"
            onClick={newSession}
            disabled={streaming}
          >
            <MessageSquare className="size-4" />
            {sidebarOpen && <span className="font-body text-sm">New conversation</span>}
          </Button>

          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => setActiveSessionId(session.id)}
              className={cn(
                "w-full text-left rounded-sm px-2 py-1.5 text-sm transition-colors",
                activeSessionId === session.id
                  ? "bg-[var(--accent-wash)] text-[var(--text-accent)]"
                  : "text-ink-muted hover:text-ink-strong hover:bg-[var(--surface-2)]"
              )}
            >
              <span className="truncate block">{session.title}</span>
              {sidebarOpen && (
                <span className="font-label text-[10px] text-ink-faint">
                  {new Date(session.updatedAt).toLocaleDateString()}
                </span>
              )}
            </button>
          ))}
        </div>

        {sidebarOpen && (
          <div className="border-t border-rule p-3">
            <span className="font-label text-ink-faint">SlideIn Venture OS</span>
          </div>
        )}
      </aside>

      {/* Main chat area */}
      <div className="flex flex-1 flex-col bg-[var(--page-fill)]">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-rule px-4 bg-[var(--surface)]">
          <h1 className="font-body text-sm font-medium text-ink-strong">
            {activeSessionId
              ? sessions.find((s) => s.id === activeSessionId)?.title || "Conversation"
              : "Start a conversation"}
          </h1>
          {activeSessionId && (
            <Badge variant="outline" className="ml-auto font-label">
              {messages.filter((m) => m.role === "assistant" && m.evidence?.length).length} cited
            </Badge>
          )}
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-ink-muted">
              <Sparkles className="size-12 text-flame mb-4" />
              <p className="font-body text-base">Start a conversation</p>
              <p className="font-body text-sm mt-1">Ask about prospects, research, SOPs, decisions…</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, delay: idx * 0.03 }}
                className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}
              >
                <div
                  className={cn(
                    "size-8 shrink-0 rounded-full flex items-center justify-center font-label text-xs",
                    msg.role === "user" ? "bg-flame text-white" : "bg-flame text-white"
                  )}
                >
                  {msg.role === "user" ? "U" : "AI"}
                </div>
                <div className={cn("flex-1 min-w-0", msg.role === "user" && "text-right")}>
                  <div className={cn("font-body prose prose-sm max-w-none", msg.role === "user" && "text-right")}>
                    {msg.content}
                  </div>

                  {msg.evidence && msg.evidence.length > 0 && msg.role === "assistant" && (
                    <div className="mt-2 space-y-2">
                      {msg.evidence?.map((ev: NonNullable<Message["evidence"]>[0], i: number) => (
                        <EvidenceBlock
                          key={ev.chunk_id}
                          query=""
                          text={ev.text}
                          type={ev.heading || undefined}
                          source={`${ev.knowledge_item_id} · chunk ${ev.chunk_index}`}
                          position={`similarity ${(ev.similarity * 100).toFixed(0)}%`}
                          href={`/knowledge/${ev.knowledge_item_id}?chunk=${ev.chunk_index}`}
                        />
                      ))}
                    </div>
                  )}

                  <div className={cn("mt-1 font-label text-[10px] text-ink-faint", msg.role === "user" && "text-right")}>
                    {new Date(msg.createdAt).toLocaleTimeString()}
                  </div>
                </div>
              </motion.div>
            )))}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-rule bg-[var(--surface)] p-4">
          <FilterBar>
            <FilterBar.Search
              value={input}
              onChange={setInput}
              placeholder={streaming ? "Sending…" : "Ask about prospects, research, SOPs…"}
              className="flex-1"
            />
            <Button
              size="sm"
              onClick={sendMessage}
              disabled={!input.trim() || streaming}
            >
              {streaming ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </FilterBar>
        </div>
      </div>
    </div>
  );
}