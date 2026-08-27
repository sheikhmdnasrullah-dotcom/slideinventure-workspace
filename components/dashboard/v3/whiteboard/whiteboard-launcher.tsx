"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WS = { id: string; section: string; title: string; snapshot: unknown; updated_at: string };

function openPopup(section: string, id?: string) {
  const url = `/whiteboard?section=${encodeURIComponent(section)}${id ? `&id=${encodeURIComponent(id)}` : ""}`;
  window.open(url, "_blank", "width=1440,height=900");
}

export default function WhiteboardLauncher({
  section,
  title,
}: {
  section: string;
  title: string;
}) {
  const [list, setList] = useState<WS[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/affine?section=${encodeURIComponent(section)}`);
    const json = await res.json();
    setList(json.workspaces ?? []);
    setLoading(false);
  }, [section]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    const res = await fetch("/api/affine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section, title: "Untitled" }),
    });
    const json = await res.json();
    if (json.workspace) openPopup(section, json.workspace.id);
  };

  const del = async (id: string) => {
    await fetch(`/api/affine/${id}?section=${encodeURIComponent(section)}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full">
      <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-card/40">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-medium">{title}</span>
          <Button size="sm" onClick={create}>
            <Plus className="size-3" /> New
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">Loading…</p>
          ) : list.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">
              No {title.toLowerCase()} yet. Create one.
            </p>
          ) : (
            list.map((w) => (
              <div
                key={w.id}
                className={cn(
                  "group flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
                )}
              >
                <button className="flex flex-1 items-center gap-2 text-left" onClick={() => openPopup(section, w.id)}>
                  <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{w.title}</span>
                </button>
                <Trash2
                  className="size-3.5 shrink-0 cursor-pointer text-muted-foreground opacity-0 group-hover:opacity-100"
                  onClick={() => del(w.id)}
                />
              </div>
            ))
          )}
        </div>
      </aside>

      <main className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
        <p className="text-sm">Pick a {title.toLowerCase()} or create one. It opens in a dedicated window.</p>
        <Button onClick={create}>
          <Plus className="size-4" /> New {title.replace(/s$/, "")}
        </Button>
      </main>
    </div>
  );
}
