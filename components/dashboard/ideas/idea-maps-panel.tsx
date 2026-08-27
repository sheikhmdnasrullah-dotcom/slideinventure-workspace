"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { formatDistanceToNow } from "date-fns";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
import { useLiveRefresh } from "@/components/providers/event-stream";

const IdeaMapCanvas = dynamic(
  () => import("./idea-map-canvas").then((m) => m.IdeaMapCanvas),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full rounded-xl" />,
  }
);

type IdeaMap = {
  id: string;
  title: string;
  updated_at: string;
};

export function IdeaMapsPanel({
  scope = "ideas",
  className,
  title = "Ideas",
}: {
  scope?: string;
  className?: string;
  title?: string;
}) {
  const [maps, setMaps] = React.useState<IdeaMap[]>([]);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draftTitle, setDraftTitle] = React.useState("");

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/idea-maps?scope=${encodeURIComponent(scope)}`);
      const json = await res.json();
      setMaps(json.maps ?? []);
    } catch {
      toast.error("Could not load idea maps");
    }
  }, [scope]);

  React.useEffect(() => {
    void load();
  }, [load]);

  useLiveRefresh(load, { types: ["ideas."] });

  const newMap = async () => {
    try {
      const res = await fetch("/api/idea-maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New idea map" }),
      });
      const json = await res.json();
      if (json.map) {
        setMaps((p) => [{ id: json.map.id, title: json.map.title, updated_at: json.map.updated_at }, ...p]);
        setOpenId(json.map.id);
      }
    } catch {
      toast.error("Could not create idea map");
    }
  };

  const rename = async (id: string, value: string) => {
    const next = value.trim() || "Untitled";
    setMaps((p) => p.map((m) => (m.id === id ? { ...m, title: next } : m)));
    setEditingId(null);
    try {
      const res = await fetch(`/api/idea-maps/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Could not rename idea map");
      void load();
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    setMaps((p) => p.filter((m) => m.id !== id));
    try {
      const res = await fetch(`/api/idea-maps/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Idea map deleted");
    } catch {
      toast.error("Could not delete idea map");
      void load();
    }
  };

  return (
    <div className={className}>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {maps.length} {maps.length === 1 ? "map" : "maps"}
        </span>
        <Button size="sm" onClick={newMap}>
          <Plus className="size-3" /> New map
        </Button>
      </div>

      <div className="mt-3 flex flex-col gap-1">
        {maps.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2"
          >
            {editingId === m.id ? (
              <Input
                autoFocus
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onBlur={() => rename(m.id, draftTitle)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    rename(m.id, draftTitle);
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setEditingId(null);
                  }
                }}
                className="h-7 flex-1"
              />
            ) : (
              <button
                onClick={() => setOpenId(m.id)}
                className="flex-1 truncate text-left text-sm text-foreground hover:underline"
              >
                {m.title}
              </button>
            )}
            <span className="shrink-0 text-xs text-muted-foreground">
              {m.updated_at ? formatDistanceToNow(new Date(m.updated_at), { addSuffix: true }) : ""}
            </span>
            {editingId !== m.id && (
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => {
                  setEditingId(m.id);
                  setDraftTitle(m.title);
                }}
                aria-label="Rename"
              >
                <Pencil className="size-3" />
              </Button>
            )}
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setDeleteId(m.id)}
              aria-label="Delete"
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        ))}

        {maps.length === 0 && (
          <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-border px-3 py-6">
            <p className="text-sm text-muted-foreground">No idea maps yet.</p>
            <Button size="sm" onClick={newMap}>
              <Plus className="size-3" /> New map
            </Button>
          </div>
        )}
      </div>

      <Dialog
        open={!!openId}
        onOpenChange={(o) => {
          if (!o) setOpenId(null);
        }}
      >
        <DialogContent className="h-[85vh] w-[90vw] max-w-none p-0">
          <DialogTitle className="sr-only">Idea map</DialogTitle>
          {openId && <IdeaMapCanvas mapId={openId} className="h-full w-full" />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete idea map</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This removes the map and its nodes. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              <X className="size-3" /> Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              <Trash2 className="size-3" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
