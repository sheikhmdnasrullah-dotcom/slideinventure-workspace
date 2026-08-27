"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Input } from "@/components/ui/input";
import { useCanvasAutosave } from "./use-canvas-autosave";
import { SaveIndicator } from "./save-indicator";

const Whiteboard = dynamic(() => import("@/components/dashboard/v3/whiteboard/Whiteboard"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
      Loading canvas…
    </div>
  ),
});

type BoardPayload = { content?: string; title?: string; scope: string };

export default function ExcalidrawPopup() {
  const [scope, setScope] = useState("global");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [initial, setInitial] = useState<string | null>(null);
  const [title, setTitle] = useState("Untitled");
  const idRef = useRef<string | null>(null);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sc = params.get("scope") || "global";
    const existingId = params.get("id");
    setScope(sc);
    scopeRef.current = sc;

    (async () => {
      try {
        if (existingId) {
          const res = await fetch(`/api/boards/${existingId}`);
          const json = await res.json();
          if (json.board) {
            idRef.current = existingId;
            setActiveId(existingId);
            setInitial(json.board.content ?? "{}");
            setTitle(json.board.title || "Untitled");
          }
        } else {
          const res = await fetch("/api/boards", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "Untitled", scope: sc }),
          });
          const json = await res.json();
          if (json.board) {
            idRef.current = json.board.id;
            setActiveId(json.board.id);
            setInitial(json.board.content ?? "{}");
            setTitle(json.board.title || "Untitled");
          }
        }
      } catch {
        // best-effort load
      }
    })();
  }, []);

  const { state, lastSavedAt, queue, flush } = useCanvasAutosave<BoardPayload>({
    delay: 700,
    merge: (prev, next) => ({ ...prev, ...next }),
    save: async (payload) => {
      const curId = idRef.current;
      if (!curId) return;
      await fetch(`/api/boards/${curId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    beacon: (payload) => {
      const curId = idRef.current;
      if (!curId) return null;
      return {
        url: `/api/boards/${curId}`,
        method: "PUT",
        body: JSON.stringify(payload),
      };
    },
  });

  const handleChange = useCallback(
    (snapshot: string) => {
      if (!idRef.current) return;
      queue({ content: snapshot, scope: scopeRef.current });
    },
    [queue]
  );

  const onTitleChange = useCallback(
    (value: string) => {
      setTitle(value);
      if (!idRef.current) return;
      queue({ title: value, scope: scopeRef.current });
    },
    [queue]
  );

  // Flush when embedded in an iframe modal and the parent requests close.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "canvas:flush") {
        flush().finally(() => {
          try {
            (e.source as Window | null)?.postMessage?.({ type: "canvas:flushed" }, e.origin);
          } catch {
            // ignore
          }
          window.parent.postMessage({ type: "canvas:flushed" }, window.location.origin);
        });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [flush]);

  return (
    <div className="flex h-screen w-screen flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border px-4 py-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Excel Draw</span>
        <Input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onBlur={() => {
            flush();
          }}
          className="h-7 w-64 text-sm"
        />
        {activeId ? (
          <SaveIndicator state={state} lastSavedAt={lastSavedAt} onRetry={() => flush()} />
        ) : (
          <span className="text-xs text-muted-foreground">Loading…</span>
        )}
      </header>
      <main className="relative flex-1">
        {activeId ? (
          <Whiteboard initialData={initial ?? "{}"} onChange={handleChange} onMount={() => {}} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Preparing canvas…
          </div>
        )}
      </main>
    </div>
  );
}
