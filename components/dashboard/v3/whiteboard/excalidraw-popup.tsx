"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Input } from "@/components/ui/input";

const Whiteboard = dynamic(() => import("@/components/dashboard/v3/whiteboard/Whiteboard"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
      Loading canvas…
    </div>
  ),
});

type Status = "loading" | "saving" | "saved";

export default function ExcalidrawPopup() {
  const [scope, setScope] = useState("global");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [initial, setInitial] = useState<string | null>(null);
  const [title, setTitle] = useState("Untitled");
  const [status, setStatus] = useState<Status>("loading");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const idRef = useRef<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sc = params.get("scope") || "global";
    const existingId = params.get("id");
    setScope(sc);

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
        setStatus("saved");
      } catch {
        setStatus("saved");
      }
    })();
  }, []);

  const handleChange = useCallback(
    (snapshot: string) => {
      const curId = idRef.current;
      if (!curId) return;
      setStatus("saving");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          await fetch(`/api/boards/${curId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: snapshot, scope }),
          });
        } catch {
          // best-effort autosave
        }
        setStatus("saved");
      }, 700);
    },
    [scope]
  );

  const saveTitle = useCallback(async () => {
    const curId = idRef.current;
    if (!curId) return;
    try {
      await fetch(`/api/boards/${curId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, scope }),
      });
    } catch {
      // ignore
    }
  }, [title, scope]);

  return (
    <div className="flex h-screen w-screen flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border px-4 py-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Excel Draw</span>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          className="h-7 w-64 text-sm"
        />
        <span className="text-xs text-muted-foreground">
          {status === "saving" ? "Saving…" : status === "loading" ? "Loading…" : "Saved"}
        </span>
      </header>
      <main className="relative flex-1">
        {activeId ? (
          <Whiteboard initialData={initial ?? "{}"} onChange={handleChange} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Preparing canvas…
          </div>
        )}
      </main>
    </div>
  );
}
