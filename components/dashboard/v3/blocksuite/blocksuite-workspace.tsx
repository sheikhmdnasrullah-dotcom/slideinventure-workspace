"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Plus, FileText, Trash2, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const BlocksuiteEditor = dynamic(() => import("./blocksuite-editor"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading editor…</div>,
});

type Workspace = {
  id: string;
  section: string;
  title: string;
  snapshot: Record<string, unknown> | null;
  updated_at: string;
};

export default function BlocksuiteWorkspace({
  section,
  title,
  mode,
}: {
  section: string;
  title: string;
  mode?: "page" | "edgeless";
}) {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [active, setActive] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const activeIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const loadList = useCallback(async () => {
    const res = await fetch(`/api/affine?section=${encodeURIComponent(section)}`);
    const json = await res.json();
    setWorkspaces(json.workspaces ?? []);
    setLoading(false);
  }, [section]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const openWorkspace = async (id: string) => {
    const res = await fetch(`/api/affine/${id}`);
    const json = await res.json();
    if (json.workspace) {
      setActive(json.workspace);
      setActiveId(id);
    }
  };

  const createWorkspace = async () => {
    const res = await fetch("/api/affine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section, title: "Untitled" }),
    });
    const json = await res.json();
    if (json.workspace) {
      await loadList();
      openWorkspace(json.workspace.id);
    }
  };

  const handleChange = useCallback((snapshot: Record<string, unknown>) => {
    const id = activeIdRef.current;
    if (!id) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        // Stale-closure bug: this used to read `activeId` (the component's
        // state variable, captured once since this callback has an empty
        // dependency array) instead of `id` (the up-to-date value read from
        // activeIdRef.current above). That made every save request target
        // `/api/affine/null` — autosave has been silently 404ing since this
        // page loaded, never persisting a single edit.
        await fetch(`/api/affine/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshot, section }),
        });
      }, 700);
  }, [section]);

  const deleteWorkspace = async (id: string) => {
    await fetch(`/api/affine/${id}?section=${encodeURIComponent(section)}`, { method: "DELETE" });
    if (activeId === id) {
      setActive(null);
      setActiveId(null);
    }
    await loadList();
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card/40">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-medium">{title}</span>
          <button
            onClick={createWorkspace}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
          >
            <Plus className="size-3" /> New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">Loading…</p>
          ) : workspaces.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">No {title.toLowerCase()} yet. Create one.</p>
          ) : (
            workspaces.map((w) => (
              <button
                key={w.id}
                onClick={() => openWorkspace(w.id)}
                className={cn(
                  "group flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent",
                  activeId === w.id && "bg-accent"
                )}
              >
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{w.title}</span>
                <Trash2
                  className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteWorkspace(w.id);
                  }}
                />
              </button>
            ))
          )}
        </div>
      </aside>

      <main className="relative flex-1">
        {active ? (
          <BlocksuiteEditor snapshot={active.snapshot} onChange={handleChange} mode={mode ?? "page"} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <p className="text-sm">Select or create a {title.toLowerCase()} to start editing with AFFiNE.</p>
            <button
              onClick={createWorkspace}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
            >
              <Plus className="size-4" /> New {title.replace(/s$/, "")}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
