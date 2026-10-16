"use client";

import * as React from "react";
import { Bot, X, Send, Loader2, Globe } from "lucide-react";
import {
  useDock,
  setDocked,
  setOpen,
  setPosition,
  openAssistant,
} from "@/lib/ui/assistant-dock";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const LONG_PRESS_MS = 550;
const MOVE_THRESHOLD = 6;

/**
 * Self-contained floating assistant.
 * - Drag the button anywhere on screen (position persists).
 * - Tap to open/close the chat panel.
 * - Press and hold (~0.5s) to dock it into the nav panel; retrieve it from
 *   the nav launcher whenever you want it back.
 * Streams from /api/assistant (DeepSeek + web search).
 */
export function FloatingChat() {
  const dock = useDock();
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  const drag = React.useRef({
    active: false,
    moved: false,
    longPressed: false,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    timer: null as ReturnType<typeof setTimeout> | null,
  });

  React.useEffect(() => {
    if (dock.open) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      inputRef.current?.focus();
    }
  }, [messages, streaming, dock.open]);

  function posStyle(): React.CSSProperties {
    if (dock.x >= 0 && dock.y >= 0) return { left: dock.x, top: dock.y };
    return { right: 16, bottom: 16 };
  }

  // Keep the panel fully on-screen, anchored next to the button. If there isn't
  // room above the button, drop it below; always clamp to the viewport.
  function panelStyle(): React.CSSProperties {
    const fallback: React.CSSProperties = { right: 16, bottom: 16 };
    if (typeof window === "undefined") return fallback;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const PW = 352;
    const PH = Math.min(544, vh - 32);
    const GAP = 12;
    const BTN = 48;
    let btnLeft = vw - BTN - 16;
    let btnTop = vh - BTN - 16;
    if (dock.x >= 0 && dock.y >= 0) {
      btnLeft = dock.x;
      btnTop = dock.y;
    }
    let top = btnTop - PH - GAP;
    if (top < 8) top = btnTop + BTN + GAP;
    if (top + PH > vh - 8) top = Math.max(8, vh - PH - 8);
    let left = btnLeft;
    if (left + PW > vw - 8) left = Math.max(8, vw - PW - 8);
    return { left, top, right: "auto", bottom: "auto" };
  }

  function clearTimer() {
    if (drag.current.timer) {
      clearTimeout(drag.current.timer);
      drag.current.timer = null;
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (dock.docked) return;
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    // If using the default bottom-right slot, convert to concrete left/top so
    // dragging math works.
    if (dock.x < 0 || dock.y < 0) {
      setPosition(rect.left, rect.top);
    }
    drag.current.active = true;
    drag.current.moved = false;
    drag.current.longPressed = false;
    drag.current.startX = e.clientX;
    drag.current.startY = e.clientY;
    drag.current.offsetX = e.clientX - rect.left;
    drag.current.offsetY = e.clientY - rect.top;
    target.setPointerCapture?.(e.pointerId);
    clearTimer();
    drag.current.timer = setTimeout(() => {
      if (drag.current.active && !drag.current.moved) {
        drag.current.longPressed = true;
        setDocked(true);
      }
    }, LONG_PRESS_MS);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.startX;
    const dy = e.clientY - drag.current.startY;
    if (!drag.current.moved && Math.hypot(dx, dy) > MOVE_THRESHOLD) {
      drag.current.moved = true;
      clearTimer();
    }
    if (drag.current.moved) {
      const maxX = window.innerWidth - 56;
      const maxY = window.innerHeight - 56;
      const x = Math.min(Math.max(0, e.clientX - drag.current.offsetX), maxX);
      const y = Math.min(Math.max(0, e.clientY - drag.current.offsetY), maxY);
      setPosition(x, y);
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    clearTimer();
    const wasMoved = drag.current.moved;
    const wasLong = drag.current.longPressed;
    drag.current.active = false;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (wasLong) return; // docked already
    if (!wasMoved) {
      setOpen(!openRef.current);
    }
  }

  // Read latest open state without a stale closure.
  const openRef = React.useRef(dock.open);
  openRef.current = dock.open;

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");

    const history = [...messages, { role: "user", content: text } as Msg];
    setMessages([...history, { role: "assistant", content: "" }]);
    setStreaming(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok || !res.body) throw new Error("stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === "delta") {
              acc += evt.content;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: acc };
                return copy;
              });
            }
          } catch {
            /* ignore malformed line */
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: "Sorry, I couldn't reach the assistant. Check the API key configuration.",
        };
        return copy;
      });
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  if (dock.docked) return null;

  return (
    <>
      {!dock.open && (
        <button
          type="button"
          aria-label="Open assistant (hold to dock to nav)"
          title="Drag to move · hold to dock to nav · tap to chat"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={posStyle()}
          className="fixed z-50 flex size-[52px] cursor-grab touch-none items-center justify-center rounded-full border border-transparent bg-button-primary text-on-button-primary shadow-float transition-transform duration-[120ms] ease-out hover:-translate-y-0.5 active:cursor-grabbing"
        >
          <Bot className="size-6" />
          <span aria-hidden className="absolute top-1 right-1 size-2 rounded-full bg-flame-vivid ring-2 ring-button-primary" />
        </button>
      )}

      {dock.open && (
        <div
          style={panelStyle()}
          className="fixed z-50 flex h-[34rem] max-h-[80vh] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-rule bg-card shadow-float"
        >
          <div className="flex items-center justify-between border-b border-rule px-4 py-3">
            <div className="flex items-center gap-2">
              <Bot className="size-[18px] text-ink-strong" />
              <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink-strong">Assistant</span>
              <span className="inline-flex h-[26px] items-center gap-1 rounded-full bg-status-neutral-bg px-2.5 text-xs font-medium text-status-neutral">
                <Globe className="size-3" /> web
              </span>
            </div>
            <button
              type="button"
              aria-label="Close assistant"
              onClick={() => setOpen(false)}
              className="flex size-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-hover-tint hover:text-ink-strong"
            >
              <X className="size-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-ink-muted">
                <Bot className="mb-2 size-8 text-ink-faint" />
                <p className="text-sm">Ask me anything.</p>
                <p className="mt-1 text-xs">I can search the web and help across the app.</p>
              </div>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={
                      "max-w-[85%] whitespace-pre-wrap break-words rounded-[14px] px-3.5 py-2.5 text-sm leading-[22px] " +
                      (m.role === "user"
                        ? "bg-button-primary text-on-button-primary"
                        : "bg-surface-2 text-ink-strong")
                    }
                  >
                    {m.content || (streaming && i === messages.length - 1 ? "…" : "")}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-border p-2">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={streaming}
                rows={1}
                placeholder="Ask a question…"
                className="max-h-28 min-h-[44px] flex-1 resize-none rounded-md border border-rule-strong bg-surface px-3.5 py-3 text-sm text-ink-strong outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-ink-faint focus-visible:border-[var(--input-focus-border)] focus-visible:shadow-[0_0_0_4px_var(--input-focus-ring)]"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={!input.trim() || streaming}
                aria-label="Send"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-button-primary text-on-button-primary shadow-button transition-transform duration-[120ms] hover:-translate-y-px active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
              >
                {streaming ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
