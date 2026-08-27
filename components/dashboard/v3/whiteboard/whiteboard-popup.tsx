"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// AFFiNE edgeless editor — loaded client-only (custom elements + WASM).
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

type Status = "loading" | "saving" | "saved";

export default function WhiteboardPopup() {
  const [section, setSection] = useState("research");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Record<string, unknown> | null>(null);
  const [title, setTitle] = useState("Untitled");
  const [status, setStatus] = useState<Status>("loading");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const idRef = useRef<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sec = params.get("section") || "research";
    const existingId = params.get("id");
    setSection(sec);

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
        setStatus("saved");
      } catch {
        setStatus("saved");
      }
    })();
  }, []);

  const handleChange = useCallback(
    (snap: Record<string, unknown>) => {
      const curId = idRef.current;
      if (!curId) return;
      setStatus("saving");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          await fetch(`/api/affine/${curId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ snapshot: snap, section }),
          });
        } catch {
          // best-effort autosave
        }
        setStatus("saved");
      }, 700);
    },
    [section]
  );

  const saveTitle = useCallback(async () => {
    const curId = idRef.current;
    if (!curId) return;
    try {
      await fetch(`/api/affine/${curId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, section }),
      });
    } catch {
      // ignore
    }
  }, [title, section]);

  return (
    <div className="flex h-screen w-screen flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border px-4 py-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{section} whiteboard</span>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          className="h-7 w-64 text-sm"
        />
        <span className="text-xs text-muted-foreground">
          {status === "saving" ? "Saving…" : status === "loading" ? "Loading…" : "Saved"}
        </span>
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
