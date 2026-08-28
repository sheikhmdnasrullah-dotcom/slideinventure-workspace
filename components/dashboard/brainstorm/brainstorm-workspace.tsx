"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import {
  NotebookPen,
  PenTool,
  LayoutGrid,
  Lightbulb,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AppFrameDialog } from "@/components/dashboard/v3/app-frame-dialog";
import { IdeaMapsPanel } from "@/components/dashboard/ideas/idea-maps-panel";
import { useLiveRefresh } from "@/components/providers/event-stream";
import { SiteHeader } from "@/components/dashboard/site-header";

const NotepadView = dynamic(
  () => import("@/components/dashboard/notepad-view").then((m) => m.NotepadView),
  { ssr: false }
);

const SECTION = "brainstorm";

const TABS = ["notepad", "draw", "whiteboard", "ideas"] as const;
type Tab = (typeof TABS)[number];

type Doc = { id: string; title: string };

export function BrainstormWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const initial = params.get("tab");
  const [tab, setTab] = useState<Tab>(
    initial && (TABS as readonly string[]).includes(initial) ? (initial as Tab) : "notepad"
  );

  const onTabChange = (value: string | number) => {
    const next = String(value) as Tab;
    setTab(next);
    const qs = new URLSearchParams(Array.from(params.entries()));
    qs.set("tab", next);
    router.replace(`${pathname}?${qs.toString()}`, { scroll: false });
  };

  return (
    <>
      <SiteHeader crumbs={[{ label: "Brainstorm" }]} subtitle="Creative workspace" />
      <div className="flex flex-1 flex-col gap-6 p-6">
      <Tabs
        value={tab}
        onValueChange={onTabChange}
        className="flex flex-1 flex-col min-h-0"
      >
        <TabsList className="w-full">
          <TabsTrigger value="notepad">
            <NotebookPen className="size-4" /> Notepad
          </TabsTrigger>
          <TabsTrigger value="draw">
            <PenTool className="size-4" /> Draw
          </TabsTrigger>
          <TabsTrigger value="whiteboard">
            <LayoutGrid className="size-4" /> Whiteboard
          </TabsTrigger>
          <TabsTrigger value="ideas">
            <Lightbulb className="size-4" /> Ideas
          </TabsTrigger>
        </TabsList>

        {tab === "notepad" && (
          <TabsContent value="notepad" className="flex-1 min-h-0">
            <NotepadView scope="brainstorm" />
          </TabsContent>
        )}

        {tab === "draw" && (
          <TabsContent value="draw" className="flex-1 min-h-0">
            <BoardList />
          </TabsContent>
        )}

        {tab === "whiteboard" && (
          <TabsContent value="whiteboard" className="flex-1 min-h-0">
            <WorkspaceList />
          </TabsContent>
        )}

        {tab === "ideas" && (
          <TabsContent value="ideas" className="flex-1 min-h-0">
            <IdeaMapsPanel scope="ideas" />
          </TabsContent>
        )}
      </Tabs>
      </div>
    </>
  );
}

function BoardList() {
  const [boards, setBoards] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [frame, setFrame] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  const load = useCallback(async () => {
    setError(false);
    try {
      const res = await fetch(`/api/boards?scope=${SECTION}`);
      const json = await res.json();
      setBoards(
        (json.boards ?? []).map((x: any) => ({ id: x.id, title: x.title || "Untitled" }))
      );
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useLiveRefresh(load, { types: ["board."] });

  const newBoard = async () => {
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled", scope: SECTION }),
      });
      const json = await res.json();
      if (json.board) {
        setBoards((p) => [
          { id: json.board.id, title: json.board.title || "Untitled" },
          ...p,
        ]);
        setFrame(`/excalidraw?scope=${SECTION}&id=${encodeURIComponent(json.board.id)}`);
        toast.success("Board created");
      }
    } catch {
      toast.error("Failed to create board");
    }
  };

  const openBoard = (id: string) =>
    setFrame(`/excalidraw?scope=${SECTION}&id=${encodeURIComponent(id)}`);

  const rename = async (id: string, value: string) => {
    const next = value.trim() || "Untitled";
    setBoards((p) => p.map((b) => (b.id === id ? { ...b, title: next } : b)));
    setEditingId(null);
    try {
      const res = await fetch(`/api/boards/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      if (!res.ok) throw new Error();
      toast.success("Board renamed");
    } catch {
      toast.error("Failed to rename board");
      void load();
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    setBoards((p) => p.filter((b) => b.id !== id));
    try {
      const res = await fetch(`/api/boards/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Board deleted");
    } catch {
      toast.error("Failed to delete board");
      void load();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {boards.length} {boards.length === 1 ? "board" : "boards"}
        </span>
        <Button size="sm" onClick={newBoard}>
          <Plus className="size-3" /> New
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-md" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-border px-3 py-6">
          <p className="text-sm text-muted-foreground">Could not load boards.</p>
          <Button size="sm" variant="outline" onClick={() => void load()}>
            <Loader2 className="size-3" /> Retry
          </Button>
        </div>
      ) : boards.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-border px-3 py-6">
          <p className="text-sm text-muted-foreground">No boards yet.</p>
          <Button size="sm" onClick={newBoard}>
            <Plus className="size-3" /> New
          </Button>
        </div>
      ) : (
        <ScrollArea className="w-full" data-lenis-prevent>
          <div className="flex flex-col gap-1 pb-2">
            {boards.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2"
              >
                {editingId === b.id ? (
                  <Input
                    autoFocus
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onBlur={() => rename(b.id, draftTitle)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        rename(b.id, draftTitle);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setEditingId(null);
                      }
                    }}
                    className="h-7 flex-1"
                  />
                ) : (
                  <button
                    onClick={() => openBoard(b.id)}
                    className="flex-1 truncate text-left text-sm hover:underline"
                  >
                    {b.title}
                  </button>
                )}
                {editingId !== b.id && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Rename"
                    onClick={() => {
                      setEditingId(b.id);
                      setDraftTitle(b.title);
                    }}
                  >
                    <Pencil className="size-3" />
                  </Button>
                )}
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Delete"
                  onClick={() => setDeleteId(b.id)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <AppFrameDialog url={frame} onClose={() => setFrame(null)} title="Brainstorm app" />

      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete board</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This removes the board. This cannot be undone.
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

function WorkspaceList() {
  const [workspaces, setWorkspaces] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [frame, setFrame] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  const load = useCallback(async () => {
    setError(false);
    try {
      const res = await fetch(`/api/affine?section=${SECTION}`);
      const json = await res.json();
      setWorkspaces(
        (json.workspaces ?? []).map((x: any) => ({ id: x.id, title: x.title || "Untitled" }))
      );
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useLiveRefresh(load, { types: ["board."] });

  const newWorkspace = async () => {
    try {
      const res = await fetch("/api/affine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: SECTION, title: "Untitled" }),
      });
      const json = await res.json();
      if (json.workspace) {
        setWorkspaces((p) => [
          { id: json.workspace.id, title: json.workspace.title || "Untitled" },
          ...p,
        ]);
        setFrame(`/whiteboard?section=${SECTION}&id=${encodeURIComponent(json.workspace.id)}`);
        toast.success("Workspace created");
      }
    } catch {
      toast.error("Failed to create workspace");
    }
  };

  const openWorkspace = (id: string) =>
    setFrame(`/whiteboard?section=${SECTION}&id=${encodeURIComponent(id)}`);

  const rename = async (id: string, value: string) => {
    const next = value.trim() || "Untitled";
    setWorkspaces((p) => p.map((w) => (w.id === id ? { ...w, title: next } : w)));
    setEditingId(null);
    try {
      const res = await fetch(`/api/affine/${id}?section=${SECTION}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      if (!res.ok) throw new Error();
      toast.success("Workspace renamed");
    } catch {
      toast.error("Failed to rename workspace");
      void load();
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    setWorkspaces((p) => p.filter((w) => w.id !== id));
    try {
      const res = await fetch(`/api/affine/${id}?section=${SECTION}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Workspace deleted");
    } catch {
      toast.error("Failed to delete workspace");
      void load();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {workspaces.length} {workspaces.length === 1 ? "workspace" : "workspaces"}
        </span>
        <Button size="sm" onClick={newWorkspace}>
          <Plus className="size-3" /> New
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-md" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-border px-3 py-6">
          <p className="text-sm text-muted-foreground">Could not load workspaces.</p>
          <Button size="sm" variant="outline" onClick={() => void load()}>
            <Loader2 className="size-3" /> Retry
          </Button>
        </div>
      ) : workspaces.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-border px-3 py-6">
          <p className="text-sm text-muted-foreground">No workspaces yet.</p>
          <Button size="sm" onClick={newWorkspace}>
            <Plus className="size-3" /> New
          </Button>
        </div>
      ) : (
        <ScrollArea className="w-full" data-lenis-prevent>
          <div className="flex flex-col gap-1 pb-2">
            {workspaces.map((w) => (
              <div
                key={w.id}
                className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2"
              >
                {editingId === w.id ? (
                  <Input
                    autoFocus
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onBlur={() => rename(w.id, draftTitle)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        rename(w.id, draftTitle);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setEditingId(null);
                      }
                    }}
                    className="h-7 flex-1"
                  />
                ) : (
                  <button
                    onClick={() => openWorkspace(w.id)}
                    className="flex-1 truncate text-left text-sm hover:underline"
                  >
                    {w.title}
                  </button>
                )}
                {editingId !== w.id && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Rename"
                    onClick={() => {
                      setEditingId(w.id);
                      setDraftTitle(w.title);
                    }}
                  >
                    <Pencil className="size-3" />
                  </Button>
                )}
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Delete"
                  onClick={() => setDeleteId(w.id)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <AppFrameDialog url={frame} onClose={() => setFrame(null)} title="Brainstorm app" />

      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete workspace</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This removes the workspace. This cannot be undone.
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
