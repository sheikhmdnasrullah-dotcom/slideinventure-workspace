"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCanvasAutosave } from "./use-canvas-autosave";
import { SaveIndicator } from "./save-indicator";

// AFFiNE edgeless editor: loaded client-only (custom elements + WASM).
const BlocksuiteEditor = dynamic(
  () => import("@/components/dashboard/v3/blocksuite/blocksuite-editor"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading editor…
      </div>
    ),
  }
);

type WorkspacePayload = { snapshot?: Record<string, unknown>; title?: string; section: string };

export default function WhiteboardPopup() {
  const [section, setSection] = useState("research");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Record<string, unknown> | null>(null);
  const [title, setTitle] = useState("Untitled");
  const idRef = useRef<string | null>(null);
  const sectionRef = useRef(section);
  sectionRef.current = section;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sec = params.get("section") || "research";
    const existingId = params.get("id");
    setSection(sec);
    sectionRef.current = sec;

    (async () => {
      try {
        if (existingId) {
          const res = await fetch(`/api/affine/${existingId}`);
          const json = await res.json();
          if (json.workspace) {
            idRef.current = existingId;
            setActiveId(existingId);
            setSnapshot(json.workspace.snapshot);
            setTitle(json.workspace.title || "Untitled");
          }
        } else {
          const res = await fetch("/api/affine", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ section: sec, title: "Untitled" }),
          });
          const json = await res.json();
          if (json.workspace) {
            idRef.current = json.workspace.id;
            setActiveId(json.workspace.id);
            setSnapshot(json.workspace.snapshot);
            setTitle(json.workspace.title || "Untitled");
          }
        }
      } catch {
        // best-effort load
      }
    })();
  }, []);

  const { state, lastSavedAt, queue, flush } = useCanvasAutosave<WorkspacePayload>({
    delay: 700,
    merge: (prev, next) => ({ ...prev, ...next }),
    save: async (payload) => {
      const curId = idRef.current;
      if (!curId) return;
      await fetch(`/api/affine/${curId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    beacon: (payload) => {
      const curId = idRef.current;
      if (!curId) return null;
      return {
        url: `/api/affine/${curId}`,
        method: "PUT",
        body: JSON.stringify(payload),
      };
    },
  });

  const handleChange = useCallback(
    (snap: Record<string, unknown>) => {
      if (!idRef.current) return;
      queue({ snapshot: snap, section: sectionRef.current });
    },
    [queue]
  );

  const onTitleChange = useCallback(
    (value: string) => {
      setTitle(value);
      if (!idRef.current) return;
      queue({ title: value, section: sectionRef.current });
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
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{section} whiteboard</span>
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
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(`/whiteboard?section=${encodeURIComponent(section)}`, "_blank", "width=1440,height=900")}
          >
            New window
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.close()}>
            Close
          </Button>
        </div>
      </header>
      <main className="relative flex-1">
        {activeId ? (
          <BlocksuiteEditor snapshot={snapshot} onChange={handleChange} mode="edgeless" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Preparing whiteboard…
          </div>
        )}
      </main>
    </div>
  );
}
