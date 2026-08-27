"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { format, isToday, isYesterday } from "date-fns";
import { Send, Loader2, Sparkles, MessageSquarePlus, ExternalLink, Trash2, BookOpen, User, Terminal, Puzzle, Link as LinkIcon, FileText } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EvidenceBlock } from "@/components/system";
import { Highlight } from "@/components/knowledge/highlight";

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

interface RetrievalResult {
  source: string;
  title: string;
  snippet: string;
  path?: string;
  url?: string;
  score: number;
}

interface SourceGroup {
  source: string;
  label: string;
  results: RetrievalResult[];
  matchCount: number;
}

interface Message {
  id: string;
  role: MessageRole;
  content: string;
  evidence?: EvidenceChunk[];
  filters?: Record<string, unknown>;
  retrievalSources?: SourceGroup[];
  retrievalQuery?: string;
  retrievalElapsedMs?: number;
  secretQuery?: boolean;
  createdAt: string;
}

interface Session {
  id: string;
  title: string;
  updatedAt: string;
}

function formatMessageTime(timestamp: string) {
  const date = new Date(timestamp);
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return `Yesterday ${format(date, "HH:mm")}`;
  return format(date, "MMM d, HH:mm");
}

function formatDateHeader(dateString: string) {
  const date = new Date(dateString);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEEE, MMMM d");
}

function groupMessagesByDay(messages: Message[]) {
  const groups: { date: string; messages: Message[] }[] = [];
  for (const message of messages) {
    const messageDate = format(new Date(message.createdAt), "yyyy-MM-dd");
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.date === messageDate) {
      lastGroup.messages.push(message);
    } else {
      groups.push({ date: messageDate, messages: [message] });
    }
  }
  return groups;
}

const SOURCE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  knowledge: BookOpen,
  leads: User,
  terminal: Terminal,
  apps: Puzzle,
  links: LinkIcon,
};

async function loadSessions(
  setSessions: (s: Session[]) => void,
  setActiveSessionId: (id: string) => void,
  activeSessionId: string | null
) {
  try {
    const res = await fetch("/api/chat/sessions");
    if (res.ok) {
      const data = await res.json();
      setSessions(
        (data ?? []).map((s: { id: string; title: string; updated_at: string }) => ({
          id: s.id,
          title: s.title,
          updatedAt: s.updated_at,
        }))
      );
      if (data.length > 0 && !activeSessionId) {
        setActiveSessionId(data[0].id);
      }
    } else {
      toast.error("Failed to load sessions");
    }
  } catch (error) {
    toast.error("Failed to load sessions");
  }
}

async function loadMessages(sessionId: string, setMessages: (m: Message[]) => void) {
  try {
    const res = await fetch(`/api/chat/messages?sessionId=${sessionId}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(
        (data ?? []).map((m: any) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content ?? "",
          evidence: m.evidence ?? [],
          filters: m.filters ?? {},
          createdAt: m.created_at ?? new Date().toISOString(),
        }))
      );
    } else {
      toast.error("Failed to load messages");
      setMessages([]);
    }
  } catch (error) {
    toast.error("Failed to load messages");
    setMessages([]);
  }
}

export function ChatInterface() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const deleteSession = async (sessionId: string) => {
    if (!confirm("Delete this conversation and all its messages?")) return;
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([]);
      }
      toast.success("Conversation deleted");
    } catch {
      toast.error("Failed to delete conversation");
    }
  };

  const newSession = () => {
    setInput("");
    setMessages([]);
    setActiveSessionId(null);
    textareaRef.current?.focus();
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    setStreaming(true);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    const userMessageId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: userMessageId, role: "user", content: text, createdAt: new Date().toISOString() }]);

    try {
      const retrieveRes = await fetch("/api/chat/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      let retrievalSources: SourceGroup[] | undefined;

      if (retrieveRes.ok) {
        const retrieveData = await retrieveRes.json();
        if (retrieveData.type === "retrieval") {
          retrievalSources = retrieveData.sources;
        }
      }

      // Remove temp user message
      setMessages((prev) => prev.filter((m) => !m.id.startsWith("temp-")));

      if (retrievalSources && retrievalSources.some((s) => s.matchCount > 0)) {
        setMessages((prev) => [
          ...prev,
          {
            id: `retrieval-${Date.now()}`,
            role: "assistant",
            content: `Found matches across ${retrievalSources.filter((s) => s.matchCount > 0).length} source${retrievalSources.filter((s) => s.matchCount > 0).length !== 1 ? "s" : ""} for "${text}"`,
            retrievalSources,
            retrievalQuery: text,
            createdAt: new Date().toISOString(),
          },
        ]);
        setStreaming(false);
        textareaRef.current?.focus();
        return;
      }

      // No retrieval matches: ask the LLM directly. The backend creates a
      // session automatically when none exists yet, so this works for a
      // brand new conversation too.
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

      loadSessions(setSessions, setActiveSessionId, activeSessionId);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [...prev, { id: `msg-${Date.now()}`, role: "assistant", content: "Sorry, something went wrong. Please try again.", createdAt: new Date().toISOString() }]);
    } finally {
      setStreaming(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  };

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const citedCount = messages.filter((m) => m.role === "assistant" && m.evidence?.length).length;
  const messageGroups = groupMessagesByDay(messages);

  return (
    <div className="flex h-full">
      {/* Sidebar - Session list */}
      <aside className="flex w-72 shrink-0 flex-col border-r bg-background">
        <div className="flex h-14 shrink-0 items-center justify-between border-b px-3">
          <span className="text-sm font-medium">Conversations</span>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2">
            <Button
              variant="outline"
              className="mb-1 w-full justify-start gap-2"
              onClick={newSession}
              disabled={streaming}
            >
              <MessageSquarePlus className="size-4" />
              New conversation
            </Button>

            {sessions.map((session) => (
              <div key={session.id} className="group relative">
                <button
                  onClick={() => setActiveSessionId(session.id)}
                  className={cn(
                    "w-full rounded-md px-2 py-2 pr-8 text-left text-sm transition-colors",
                    activeSessionId === session.id
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <span className="block truncate">{session.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(session.updatedAt).toLocaleDateString()}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="Delete conversation"
                  onClick={() => deleteSession(session.id)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Main chat area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
          <h1 className="truncate text-sm font-semibold">
            {activeSessionId ? activeSession?.title || "Conversation" : "Start a conversation"}
          </h1>
          {activeSessionId && citedCount > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {citedCount} cited
            </Badge>
          )}
        </div>

        {/* Messages */}
        <ScrollArea className="min-w-0 flex-1 px-4">
          <div className="min-w-0 space-y-4 py-4">
            {messages.length === 0 ? (
              <div className="flex h-full min-h-[50vh] flex-col items-center justify-center text-center text-muted-foreground">
                <Sparkles className="mb-4 size-10 text-muted-foreground/60" />
                <p className="text-base">Start a conversation</p>
                 <p className="mt-1 text-sm">Ask about knowledge, research, SOPs, or decisions</p>
              </div>
            ) : (
              messageGroups.map((group) => (
                <div key={group.date}>
                  <div className="flex items-center justify-center py-2">
                    <div className="rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">
                      {formatDateHeader(group.date)}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {group.messages.map((msg, idx) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15, delay: idx * 0.03 }}
                        className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}
                      >
                        {msg.role === "assistant" && (
                          <Avatar size="sm" className="mt-0.5 shrink-0">
                            <AvatarFallback>AI</AvatarFallback>
                          </Avatar>
                        )}

                         <div className={cn("max-w-[70%] min-w-0 break-words", msg.role === "user" && "flex flex-col items-end")}>
                          <div
                            className={cn(
                              "rounded-lg px-3 py-2 text-sm break-words",
                              msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                            )}
                          >
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          </div>

                          {msg.retrievalSources && (
                            <Card className="motion-card mt-2 min-w-0 w-full overflow-hidden">
                              <div className="border-b bg-muted/30 px-3 py-2">
                                <p className="text-xs font-medium text-muted-foreground">
                                  From your data
                                  {msg.retrievalElapsedMs !== undefined && (
                                    <span className="ml-2 text-[10px] text-muted-foreground/70">
                                      ({msg.retrievalElapsedMs}ms)
                                    </span>
                                  )}
                                </p>
                              </div>
                              <div className="divide-y">
                                {msg.retrievalSources.map((group) => (
                                  <div key={group.source} className="min-w-0 p-3">
                                    <div className="flex items-center gap-2">
                                       <span className="text-muted-foreground">{(() => { const Icon = SOURCE_ICONS[group.source] ?? FileText; return <Icon className="size-4" />; })()}</span>
                                      <span className="text-xs font-medium">{group.label}</span>
                                      <Badge variant="secondary" className="text-[10px]">
                                        {group.matchCount} match{group.matchCount !== 1 ? "es" : ""}
                                      </Badge>
                                    </div>
                                    {group.results.length === 0 ? (
                                      <p className="mt-1.5 text-xs text-muted-foreground italic">No matches in this source</p>
                                    ) : (
                                      <div className="mt-2 space-y-2">
                                        {group.results.map((result, idx) => (
                                          <div key={idx} className="min-w-0 overflow-hidden rounded-md border bg-background p-2">
                                            <div className="flex items-center gap-2">
                                              <span className="min-w-0 truncate text-xs font-medium">{result.title}</span>
                                            </div>
                                            <p className="mt-1 break-words text-xs text-muted-foreground">
                                              <Highlight text={result.snippet} query={msg.retrievalQuery || ""} />
                                            </p>
                                            <div className="mt-1.5 flex items-center gap-3">
                                              {result.path ? (
                                                <Link
                                                  href={result.path}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                                >
                                                  Open source <ExternalLink className="size-3" />
                                                </Link>
                                              ) : (
                                                result.url && (
                                                  <a href={result.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                                                    Visit <ExternalLink className="size-3" />
                                                  </a>
                                                )
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </Card>
                          )}

                          {msg.evidence && msg.evidence.length > 0 && msg.role === "assistant" && (
                            <div className="mt-2 w-full space-y-2">
                              {msg.evidence.map((ev) => (
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

                          <div className="mt-1 text-xs text-muted-foreground">
                            {formatMessageTime(msg.createdAt)}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))
            )}

            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Composer */}
        <div className="shrink-0 border-t p-4">
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              disabled={streaming}
              placeholder={streaming ? "Sending" : "Ask about knowledge, research, or SOPs"}
              rows={1}
              className="max-h-40 min-h-[40px] flex-1 resize-none"
            />
            <Button size="icon" onClick={sendMessage} disabled={!input.trim() || streaming}>
              {streaming ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
