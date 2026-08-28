"use client";

import { useEffect, useRef, useState } from "react";
import {
  X,
  Minus,
  Sparkles,
  Bot,
  Send,
  Loader2,
  Minimize2,
  ExternalLink,
  ArrowDownToLine,
  PanelLeftClose,
  FileText,
  GripHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  useDeployedAgent,
  setDeployPosition,
  setDeployViewMode,
  toggleDeployViewMode,
  dockAgentToNavbar,
  closeDeployedAgent,
  addAgentMessage,
  setAgentThinking,
  attachToTarget,
} from "@/lib/agents/deployed-agent-store";
import { toast } from "sonner";

export function DraggableDeployedAgent() {
  const {
    isOpen,
    viewMode,
    agent,
    position,
    target,
    noteContext,
    messages,
    isThinking,
  } = useDeployedAgent();

  const [isDragging, setIsDragging] = useState(false);
  const [isHoveringDropzone, setIsHoveringDropzone] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [inputMessage, setInputMessage] = useState("");

  const dragStartRef = useRef<{ x: number; y: number; startPosX: number; startPosY: number } | null>(null);
  const hasMovedRef = useRef(false);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current && viewMode === "expanded") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, viewMode]);

  if (!isOpen || !agent) return null;

  // --- Pointer/Mouse Event Handlers for Dragging and Long-Press Hold to Dock ---

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only handle primary mouse button
    if (e.button !== 0) return;

    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startPosX: position.x,
      startPosY: position.y,
    };
    hasMovedRef.current = false;

    // Start Long-Press timer: "When I don't want it on the screen I can hold it and it gets back to the navbar"
    setHoldProgress(0);
    const startTime = Date.now();
    const HOLD_DURATION = 850; // ms to trigger dock

    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, (elapsed / HOLD_DURATION) * 100);
      setHoldProgress(progress);
      if (progress >= 100) {
        clearInterval(holdIntervalRef.current!);
        holdIntervalRef.current = null;
        dockAgentToNavbar();
        toast.info(`${agent.name} docked back to the navbar`, {
          description: "Tap 'Deploy Agent' in the sidebar or navbar anytime to summon it again.",
        });
      }
    }, 40);

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!dragStartRef.current) return;
      const dx = moveEvent.clientX - dragStartRef.current.x;
      const dy = moveEvent.clientY - dragStartRef.current.y;

      if (Math.hypot(dx, dy) > 5) {
        hasMovedRef.current = true;
        setIsDragging(true);

        // If moved, cancel the hold-to-dock timer
        if (holdIntervalRef.current) {
          clearInterval(holdIntervalRef.current);
          holdIntervalRef.current = null;
          setHoldProgress(0);
        }

        const newX = Math.max(10, Math.min(window.innerWidth - 70, dragStartRef.current.startPosX + dx));
        const newY = Math.max(10, Math.min(window.innerHeight - 70, dragStartRef.current.startPosY + dy));
        setDeployPosition(newX, newY);

        // Detect if hovering over a droppable target (e.g. Notepad)
        const elemUnder = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
        const droppable = elemUnder?.closest("[data-droppable='notepad']");
        setIsHoveringDropzone(Boolean(droppable));
      }
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);

      if (holdIntervalRef.current) {
        clearInterval(holdIntervalRef.current);
        holdIntervalRef.current = null;
        setHoldProgress(0);
      }

      setIsDragging(false);

      // Check if dropped into a droppable target
      if (hasMovedRef.current) {
        const elemUnder = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
        const notepadTarget = elemUnder?.closest("[data-droppable='notepad']") as HTMLElement | null;

        if (notepadTarget) {
          const noteId = notepadTarget.getAttribute("data-note-id") || "";
          const noteTitle = notepadTarget.getAttribute("data-note-title") || "Active Note";
          attachToTarget("notepad", { id: noteId, title: noteTitle });
          toast.success(`${agent.name} deployed into Notepad!`, {
            description: `Agent attached to "${noteTitle}".`,
          });
        }
      } else {
        // If not dragged (clicked), toggle between circle and expanded mode
        toggleDeployViewMode();
      }

      dragStartRef.current = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // --- Agent Chat & Task Execution ---

  const handleSendMessage = async (customPrompt?: string) => {
    const text = customPrompt || inputMessage.trim();
    if (!text || isThinking) return;

    if (!customPrompt) setInputMessage("");

    const userMsg = { role: "user" as const, content: text };
    addAgentMessage(userMsg);
    setAgentThinking(true);

    try {
      // Build context prompt if deployed into Notepad
      let enhancedMessage = text;
      if (target === "notepad" && noteContext?.id) {
        enhancedMessage = `Context: The user is working on note "${noteContext.title}".\n\nTask: ${text}`;
      }

      const res = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: agent.slug,
          message: enhancedMessage,
          history: messages.slice(-8),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Agent did not respond");

      const cleanAnswer = (data.answer || "Task completed.").replace(/[—–]/g, "-");
      addAgentMessage({ role: "assistant", content: cleanAnswer });

      // If requested, also capture insight directly into Research Lab
      if (target === "notepad" || customPrompt?.toLowerCase().includes("research")) {
        fetch("/api/research-lab/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "agent",
            sourceRef: `deploy-${agent.slug}-${Date.now()}`,
            title: `${agent.name}: ${text.slice(0, 60)}`,
            rawText: `Task: ${text}\n\nFindings:\n${cleanAnswer}`,
            reference: { tab: "notepad", note: noteContext?.id || "" },
          }),
        }).catch(() => {});
      }
    } catch (err: any) {
      addAgentMessage({
        role: "assistant",
        content: `Error: ${err.message || "Failed to execute agent action."}`,
      });
    } finally {
      setAgentThinking(false);
    }
  };

  // Insert answer directly into note editor
  const handleInsertToNote = (content: string) => {
    const event = new CustomEvent("notepad:insert-text", { detail: { text: content } });
    window.dispatchEvent(event);
    toast.success("Inserted findings into your note!");
  };

  const color = agent.color || "#6366f1";

  // --- Render Mode A: Floating Circle Icon ---
  if (viewMode === "circle") {
    return (
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          touchAction: "none",
        }}
        className={`fixed top-0 left-0 z-50 select-none transition-shadow ${
          isDragging ? "cursor-grabbing scale-110" : "cursor-grab hover:scale-105"
        }`}
      >
        <div className="relative group flex items-center justify-center">
          {/* Hold progress ring animation */}
          {holdProgress > 0 && (
            <svg className="absolute -inset-1.5 size-[68px] -rotate-90 pointer-events-none">
              <circle
                cx="34"
                cy="34"
                r="30"
                className="stroke-muted/40 fill-none stroke-2"
              />
              <circle
                cx="34"
                cy="34"
                r="30"
                className="stroke-rose-500 fill-none stroke-[3px] transition-all"
                strokeDasharray={188.4}
                strokeDashoffset={188.4 - (188.4 * holdProgress) / 100}
                strokeLinecap="round"
              />
            </svg>
          )}

          {/* Main Circle Icon Widget */}
          <div
            className={`flex size-14 items-center justify-center rounded-full text-2xl shadow-xl backdrop-blur-xl border-2 transition-all ${
              isHoveringDropzone ? "ring-4 ring-emerald-500/70 scale-115" : ""
            }`}
            style={{
              backgroundColor: "rgba(18, 18, 24, 0.88)",
              borderColor: isHoveringDropzone ? "#10b981" : color,
              boxShadow: isHoveringDropzone
                ? "0 0 30px rgba(16, 185, 129, 0.6)"
                : `0 8px 32px -4px ${color}50`,
            }}
          >
            <span>{agent.emoji || "🤖"}</span>

            {/* Pulsing indicator dot */}
            <span
              className="absolute top-0 right-0 flex size-3.5 items-center justify-center"
            >
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                style={{ backgroundColor: color }}
              />
              <span
                className="relative inline-flex size-2.5 rounded-full"
                style={{ backgroundColor: color }}
              />
            </span>
          </div>

          {/* Floating Tooltip Label */}
          <div className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-background/90 px-2 py-0.5 text-[10px] font-medium text-foreground opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover:opacity-100 border border-border">
            {holdProgress > 0
              ? "Hold to dock to navbar…"
              : `${agent.name} • Drag to deploy • Hold to dock`}
          </div>
        </div>
      </div>
    );
  }

  // --- Render Mode B: Expanded Deployed Agent Card ---
  return (
    <div
      ref={containerRef}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
      }}
      className="fixed top-0 left-0 z-50 w-[380px] max-h-[580px] flex flex-col rounded-2xl border border-border/80 bg-background/95 shadow-2xl backdrop-blur-2xl overflow-hidden transition-shadow select-text"
    >
      {/* Draggable Card Header */}
      <div
        onPointerDown={handlePointerDown}
        className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/40 cursor-grab active:cursor-grabbing select-none"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-sm border"
            style={{
              backgroundColor: `${color}18`,
              borderColor: color,
            }}
          >
            {agent.emoji || "🤖"}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-xs text-foreground truncate">
              {agent.name}
            </span>
            <span className="text-[10px] text-muted-foreground truncate">
              {target === "notepad" && noteContext?.title
                ? `Deployed: ${noteContext.title}`
                : "Active Deployed Agent"}
            </span>
          </div>
        </div>

        {/* Window Controls */}
        <div className="flex items-center gap-1">
          <Button
            size="icon-xs"
            variant="ghost"
            title="Minimize to floating circle"
            onClick={(e) => {
              e.stopPropagation();
              setDeployViewMode("circle");
            }}
            className="size-6"
          >
            <Minus className="size-3" />
          </Button>

          <Button
            size="icon-xs"
            variant="ghost"
            title="Dock back to navbar"
            onClick={(e) => {
              e.stopPropagation();
              dockAgentToNavbar();
              toast.info(`${agent.name} docked back to the navbar`);
            }}
            className="size-6 text-muted-foreground hover:text-foreground"
          >
            <PanelLeftClose className="size-3" />
          </Button>

          <Button
            size="icon-xs"
            variant="ghost"
            title="Close"
            onClick={(e) => {
              e.stopPropagation();
              closeDeployedAgent();
            }}
            className="size-6 text-muted-foreground hover:text-destructive"
          >
            <X className="size-3" />
          </Button>
        </div>
      </div>

      {/* Target Context Banner */}
      {target === "notepad" && noteContext?.title && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-primary/10 border-b border-primary/20 text-[11px] text-primary">
          <span className="truncate flex items-center gap-1.5">
            <FileText className="size-3.5 shrink-0" />
            <span className="font-medium truncate">Note: {noteContext.title}</span>
          </span>
          <span className="shrink-0 text-[10px] bg-primary/20 px-1.5 py-0.5 rounded font-medium">
            Attached
          </span>
        </div>
      )}

      {/* Quick Action Chips */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border/40 overflow-x-auto bg-muted/10 text-[11px]" data-lenis-prevent>
        <button
          onClick={() => handleSendMessage("Perform deep research on the core topics of this note and extract key findings.")}
          disabled={isThinking}
          className="shrink-0 rounded-md bg-secondary/80 hover:bg-secondary px-2 py-1 text-secondary-foreground transition-colors cursor-pointer"
        >
          ⚡ Research Note
        </button>
        <button
          onClick={() => handleSendMessage("Summarize this note into 3 clear, high-signal bullet points without any em-dashes.")}
          disabled={isThinking}
          className="shrink-0 rounded-md bg-secondary/80 hover:bg-secondary px-2 py-1 text-secondary-foreground transition-colors cursor-pointer"
        >
          📝 Summarize
        </button>
        <button
          onClick={() => handleSendMessage("What are the best concrete next steps and actionable recommendations based on this?")}
          disabled={isThinking}
          className="shrink-0 rounded-md bg-secondary/80 hover:bg-secondary px-2 py-1 text-secondary-foreground transition-colors cursor-pointer"
        >
          🎯 Action Items
        </button>
      </div>

      {/* Chat / Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[300px]" data-lenis-prevent>
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex flex-col text-xs leading-relaxed ${
              msg.role === "user" ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`rounded-xl px-3.5 py-2 max-w-[90%] whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground font-medium"
                  : "bg-muted/70 text-foreground border border-border/60"
              }`}
            >
              {msg.content}
            </div>

            {/* Insert into note button for assistant responses */}
            {msg.role === "assistant" && idx > 0 && target === "notepad" && (
              <button
                type="button"
                onClick={() => handleInsertToNote(msg.content)}
                className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors cursor-pointer"
              >
                <ArrowDownToLine className="size-3" />
                <span>Insert to note</span>
              </button>
            )}
          </div>
        ))}

        {isThinking && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
            <Loader2 className="size-3.5 animate-spin text-primary" />
            <span>{agent.name} is thinking…</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Prompt Box */}
      <div className="p-3 border-t border-border/60 bg-muted/20">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <Textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={`Ask ${agent.name} anything…`}
            rows={1}
            className="min-h-[38px] max-h-[100px] resize-none text-xs bg-background"
          />
          <Button
            type="submit"
            size="icon-sm"
            disabled={!inputMessage.trim() || isThinking}
            className="shrink-0 size-9"
          >
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
