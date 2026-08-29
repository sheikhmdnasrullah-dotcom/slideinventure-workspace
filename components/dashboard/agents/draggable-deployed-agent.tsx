"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import {
  X,
  Minus,
  Sparkles,
  Send,
  Loader2,
  ArrowDownToLine,
  PanelLeftClose,
  FileText,
  Copy,
  Check,
  RotateCcw,
  FlaskConical,
  PenTool,
  FolderOpen,
  HelpCircle,
  Link2,
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
  resetAgentConversation,
  type DeployTarget,
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
  const [hoverTargetTitle, setHoverTargetTitle] = useState<string | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [inputMessage, setInputMessage] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const dragStartRef = useRef<{ x: number; y: number; startPosX: number; startPosY: number } | null>(null);
  const hasMovedRef = useRef(false);
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (messagesEndRef.current && viewMode === "expanded") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, viewMode, isThinking]);

  // Keep widget clamped inside visible viewport on screen resize
  useEffect(() => {
    const handleResize = () => {
      const cardWidth = viewMode === "expanded" ? 390 : 64;
      const cardHeight = viewMode === "expanded" ? 520 : 64;
      const maxX = Math.max(12, window.innerWidth - cardWidth - 12);
      const maxY = Math.max(12, window.innerHeight - cardHeight - 12);

      if (position.x > maxX || position.y > maxY) {
        setDeployPosition(Math.min(position.x, maxX), Math.min(position.y, maxY));
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [position, viewMode]);

  if (!isOpen || !agent) return null;

  // Target metadata helper
  const targetMeta = (() => {
    switch (target) {
      case "notepad":
        return { icon: FileText, label: noteContext?.title ? `Note: ${noteContext.title}` : "Notepad" };
      case "brainstorm":
        return { icon: PenTool, label: noteContext?.title ? `Board: ${noteContext.title}` : "Brainstorm Canvas" };
      case "files":
        return { icon: FolderOpen, label: "AI Venture Files" };
      case "research":
        return { icon: FlaskConical, label: "Research Lab" };
      case "query":
        return { icon: HelpCircle, label: "AI Query" };
      case "useful-links":
        return { icon: Link2, label: "Useful Links" };
      default:
        return { icon: Sparkles, label: "Screen" };
    }
  })();

  // Dynamic context action chips
  const actionChips = (() => {
    switch (target) {
      case "notepad":
        return [
          { label: "⚡ Research Note", prompt: "Perform deep research on the core topics of this note and extract key strategic findings." },
          { label: "📝 Summarize", prompt: "Summarize this note into 3 clear, high-signal bullet points without any em-dashes." },
          { label: "🎯 Action Items", prompt: "What are the best concrete next steps and actionable recommendations based on this note?" },
        ];
      case "brainstorm":
        return [
          { label: "💡 Brainstorm Concepts", prompt: "Generate 5 bold, creative visual ideas and concepts for this whiteboard workspace." },
          { label: "🗺️ Structure Plan", prompt: "Decompose this brainstorming topic into a structured visual roadmap and milestones." },
          { label: "🎯 Action Priorities", prompt: "What are the top 3 actionable next steps to execute on this canvas?" },
        ];
      case "files":
        return [
          { label: "🔍 Analyze Files", prompt: "Analyze the files in this workspace and identify key patterns, gaps, or opportunities." },
          { label: "📝 Summarize Folder", prompt: "Provide a structured executive summary of the content and structure in this workspace." },
          { label: "💡 Recommendations", prompt: "What templates, assets, or documents should we create next?" },
        ];
      case "research":
        return [
          { label: "🔬 Synthesize Findings", prompt: "Synthesize the main takeaways across all research lab items into a cohesive strategy." },
          { label: "🔎 Identify Gaps", prompt: "What crucial market data or research questions are missing from our current research items?" },
          { label: "🚀 Strategic Initiatives", prompt: "Formulate top 3 strategic initiatives based on our cumulative research findings." },
        ];
      default:
        return [
          { label: "⚡ Deep Research", prompt: "Perform deep research and structured multi-angle analysis on this topic." },
          { label: "📝 Summarize", prompt: "Provide a clear, structured summary with actionable insights and zero em-dashes." },
          { label: "🎯 Next Steps", prompt: "Outline concrete tactical next steps to execute on this immediately." },
        ];
    }
  })();

  // --- Pointer/Mouse Event Handlers for Dragging and Long-Press Hold to Dock ---

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only handle primary mouse button
    if (e.button !== 0) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // best effort
    }

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
    const HOLD_DURATION = 800; // ms to trigger dock

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
    }, 35);

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

        const cardWidth = viewMode === "expanded" ? 385 : 60;
        const cardHeight = viewMode === "expanded" ? 500 : 60;
        const newX = Math.max(10, Math.min(window.innerWidth - cardWidth - 10, dragStartRef.current.startPosX + dx));
        const newY = Math.max(10, Math.min(window.innerHeight - cardHeight - 10, dragStartRef.current.startPosY + dy));
        setDeployPosition(newX, newY);

        // Detect if hovering over any droppable target
        const elemUnder = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
        const droppable = elemUnder?.closest("[data-droppable]") as HTMLElement | null;
        if (droppable) {
          setIsHoveringDropzone(true);
          const dropTitle =
            droppable.getAttribute("data-drop-title") ||
            droppable.getAttribute("data-note-title") ||
            droppable.getAttribute("data-droppable") ||
            "Workspace";
          setHoverTargetTitle(dropTitle);
        } else {
          setIsHoveringDropzone(false);
          setHoverTargetTitle(null);
        }
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
      setIsHoveringDropzone(false);
      setHoverTargetTitle(null);

      // Check if dropped into a droppable target
      if (hasMovedRef.current) {
        const elemUnder = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
        const droppable = elemUnder?.closest("[data-droppable]") as HTMLElement | null;

        if (droppable) {
          const targetType = (droppable.getAttribute("data-droppable") || "workspace") as DeployTarget;
          const dropTitle =
            droppable.getAttribute("data-drop-title") ||
            droppable.getAttribute("data-note-title") ||
            "Workspace";
          const dropId =
            droppable.getAttribute("data-drop-id") ||
            droppable.getAttribute("data-note-id") ||
            "";

          attachToTarget(targetType, { id: dropId, title: dropTitle });
          toast.success(`${agent.name} deployed into ${dropTitle}!`, {
            description: `Agent attached to ${dropTitle}. Use the controls or chips to collaborate.`,
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
      // Build context prompt based on active deployment target
      let enhancedMessage = text;
      if (target === "notepad" && noteContext?.title) {
        enhancedMessage = `Context: The user is working on note "${noteContext.title}".\n\nTask: ${text}`;
      } else if (target === "brainstorm") {
        enhancedMessage = `Context: The user is working on Brainstorm Whiteboard "${noteContext?.title || "Active Canvas"}".\n\nTask: ${text}`;
      } else if (target === "files") {
        enhancedMessage = `Context: The user is working on AI Venture Files.\n\nTask: ${text}`;
      } else if (target === "research") {
        enhancedMessage = `Context: The user is in the AI Venture Research Lab.\n\nTask: ${text}`;
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

      let data: any = null;
      const rawText = await res.text();
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        data = null;
      }

      if (!res.ok || !data) {
        const errorMsg =
          data?.error ||
          (res.status === 504
            ? "Agent response timed out. Please try asking a more focused question."
            : res.status === 401
              ? "Please sign in to chat with the agent."
              : `Agent service error (${res.status})`);
        throw new Error(errorMsg);
      }

      const cleanAnswer = (data.answer || "Task completed.").replace(/[—–]/g, "-");
      addAgentMessage({ role: "assistant", content: cleanAnswer });

      // Automatically capture insight directly into Research Lab
      if (target === "notepad" || target === "research" || customPrompt?.toLowerCase().includes("research")) {
        fetch("/api/research-lab/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "agent",
            sourceRef: `deploy-${agent.slug}-${Date.now()}`,
            title: `${agent.name}: ${text.slice(0, 60)}`,
            rawText: `Task: ${text}\n\nFindings:\n${cleanAnswer}`,
            reference: { tab: target || "notepad", note: noteContext?.id || "" },
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

  // Push specific message to Research Lab manually
  const handlePushToResearchLab = (content: string) => {
    fetch("/api/research-lab/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "agent",
        sourceRef: `manual-${agent.slug}-${Date.now()}`,
        title: `${agent.name} Insight`,
        rawText: content,
        reference: { tab: target || "notepad", note: noteContext?.id || "" },
      }),
    })
      .then((res) => {
        if (res.ok) toast.success("Pushed insight to Research Lab!");
        else toast.error("Could not push to Research Lab");
      })
      .catch(() => toast.error("Network error pushing to Research Lab"));
  };

  // Copy to clipboard
  const handleCopy = (content: string, idx: number) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedIdx(idx);
      toast.success("Copied response to clipboard!");
      setTimeout(() => setCopiedIdx(null), 2000);
    });
  };

  const color = agent.color || "#6366f1";
  const TargetIcon = targetMeta.icon;

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
            <svg className="absolute -inset-2 size-[72px] -rotate-90 pointer-events-none">
              <circle
                cx="36"
                cy="36"
                r="31"
                className="stroke-muted/40 fill-none stroke-2"
              />
              <circle
                cx="36"
                cy="36"
                r="31"
                className="stroke-rose-500 fill-none stroke-[3.5px] transition-all"
                strokeDasharray={194.7}
                strokeDashoffset={194.7 - (194.7 * holdProgress) / 100}
                strokeLinecap="round"
              />
            </svg>
          )}

          {/* Main Circle Icon Widget */}
          <div
            className={`flex size-14 items-center justify-center rounded-full text-2xl shadow-xl backdrop-blur-xl border-2 transition-all ${
              isHoveringDropzone ? "ring-4 ring-emerald-500/80 scale-115" : ""
            }`}
            style={{
              backgroundColor: "rgba(18, 18, 24, 0.90)",
              borderColor: isHoveringDropzone ? "#10b981" : color,
              boxShadow: isHoveringDropzone
                ? "0 0 32px rgba(16, 185, 129, 0.7)"
                : `0 8px 32px -4px ${color}50`,
            }}
          >
            <span>{agent.emoji || "🤖"}</span>

            {/* Pulsing indicator dot */}
            <span className="absolute top-0 right-0 flex size-3.5 items-center justify-center">
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
          <div className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-background/95 px-2.5 py-0.5 text-[10px] font-medium text-foreground opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover:opacity-100 border border-border">
            {holdProgress > 0
              ? "Hold to dock to navbar…"
              : isHoveringDropzone && hoverTargetTitle
                ? `Drop to deploy into ${hoverTargetTitle}`
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
      className="fixed top-0 left-0 z-50 w-[385px] max-h-[580px] flex flex-col rounded-2xl border border-border/80 bg-background/95 shadow-2xl backdrop-blur-2xl overflow-hidden transition-shadow select-text"
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
              {targetMeta.label}
            </span>
          </div>
        </div>

        {/* Window Controls */}
        <div className="flex items-center gap-1">
          <Button
            size="icon-xs"
            variant="ghost"
            title="Reset conversation"
            onClick={(e) => {
              e.stopPropagation();
              resetAgentConversation();
              toast.info("Conversation reset");
            }}
            className="size-6 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3" />
          </Button>

          <Button
            size="icon-xs"
            variant="ghost"
            title="Minimize to floating circle"
            onClick={(e) => {
              e.stopPropagation();
              setDeployViewMode("circle");
            }}
            className="size-6 text-muted-foreground hover:text-foreground"
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
      <div className="flex items-center justify-between px-4 py-1.5 bg-primary/10 border-b border-primary/20 text-[11px] text-primary">
        <span className="truncate flex items-center gap-1.5 min-w-0">
          <TargetIcon className="size-3.5 shrink-0" />
          <span className="font-medium truncate">{targetMeta.label}</span>
        </span>
        <span className="shrink-0 text-[9px] bg-primary/20 px-1.5 py-0.5 rounded font-medium ml-2">
          {target === "screen" ? "Floating" : "Attached"}
        </span>
      </div>

      {/* Quick Action Chips */}
      <div
        className="flex items-center gap-1.5 px-4 py-2 border-b border-border/40 overflow-x-auto bg-muted/10 text-[11px]"
        data-lenis-prevent
      >
        {actionChips.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(chip.prompt)}
            disabled={isThinking}
            className="shrink-0 rounded-md bg-secondary/80 hover:bg-secondary px-2 py-1 text-secondary-foreground transition-colors cursor-pointer disabled:opacity-50"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Chat / Messages Area */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[300px]"
        data-lenis-prevent
      >
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

            {/* Action buttons for assistant responses */}
            {msg.role === "assistant" && idx > 0 && (
              <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                {/* Copy */}
                <button
                  type="button"
                  onClick={() => handleCopy(msg.content, idx)}
                  className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                >
                  {copiedIdx === idx ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                  <span>{copiedIdx === idx ? "Copied" : "Copy"}</span>
                </button>

                {/* Insert to note */}
                {target === "notepad" && (
                  <button
                    type="button"
                    onClick={() => handleInsertToNote(msg.content)}
                    className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                  >
                    <ArrowDownToLine className="size-3" />
                    <span>Insert to note</span>
                  </button>
                )}

                {/* Push to Research Lab */}
                <button
                  type="button"
                  onClick={() => handlePushToResearchLab(msg.content)}
                  className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                >
                  <FlaskConical className="size-3" />
                  <span>Push to lab</span>
                </button>
              </div>
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
