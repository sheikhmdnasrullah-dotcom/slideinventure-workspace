"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, FolderOpen, LayoutGrid, PenTool, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { AppFrameDialog } from "@/components/dashboard/v3/app-frame-dialog";

const SCOPE = "research";

type Project = {
  id: string;
  title: string;
  description: string;
  sources: string;
  excelBoardId?: string;
  affineWorkspaceId?: string;
};

function emptyProject(): Project {
  return { id: "", title: "New Project", description: "", sources: "" };
}

export function ResearchLabWorkspace() {
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [active, setActive] = useState<Project | null>(null);
  const [frame, setFrame] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    const res = await fetch(`/api/boards?scope=${SCOPE}`);
    const json = await res.json();
    setProjects((json.boards ?? []).map((b: any) => ({ id: b.id, title: b.title || "Untitled" })));
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const persist = useCallback(async (p: Project) => {
    try {
      await fetch(`/api/boards/${p.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: p.title,
          content: JSON.stringify({
            description: p.description,
            sources: p.sources,
            excelBoardId: p.excelBoardId,
            affineWorkspaceId: p.affineWorkspaceId,
          }),
          scope: SCOPE,
        }),
      });
    } catch {
      // best-effort
    }
  }, []);

  const patch = useCallback(
    (patch: Partial<Project>) => {
      if (!active) return;
      const next = { ...active, ...patch };
      setActive(next);
      persist(next);
    },
    [active, persist]
  );

  const newProject = async () => {
    const res = await fetch("/api/boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "New Research Project",
        scope: SCOPE,
        content: JSON.stringify({ description: "", sources: "" }),
      }),
    });
    const json = await res.json();
    if (json.board) {
      setProjects((p) => [...p, { id: json.board.id, title: json.board.title || "Untitled" }]);
      setActive({ id: json.board.id, title: json.board.title || "Untitled", description: "", sources: "" });
    }
  };

  const selectProject = async (id: string) => {
    const res = await fetch(`/api/boards/${id}`);
    const json = await res.json();
    const content = json.board?.content ? JSON.parse(json.board.content || "{}") : {};
    setActive({
      id,
      title: json.board?.title || "Untitled",
      description: content.description || "",
      sources: content.sources || "",
      excelBoardId: content.excelBoardId,
      affineWorkspaceId: content.affineWorkspaceId,
    });
  };

  const ensureExcel = useCallback(async (): Promise<string | null> => {
    if (active?.excelBoardId) return active.excelBoardId;
    const res = await fetch("/api/boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: `${active?.title || "Project"} — Excel Draw`, scope: SCOPE }),
    });
    const json = await res.json();
    const id = json.board?.id ?? null;
    if (id) patch({ excelBoardId: id });
    return id;
  }, [active, patch]);

  const ensureAffine = useCallback(async (): Promise<string | null> => {
    if (active?.affineWorkspaceId) return active.affineWorkspaceId;
    const res = await fetch("/api/affine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: SCOPE, title: `${active?.title || "Project"} — Affine` }),
    });
    const json = await res.json();
    const id = json.workspace?.id ?? null;
    if (id) patch({ affineWorkspaceId: id });
    return id;
  }, [active, patch]);

  const openExcel = async () => {
    if (!active) return;
    setBusy(true);
    const id = await ensureExcel();
    setBusy(false);
    if (id) setFrame(`/excalidraw?scope=${SCOPE}&id=${encodeURIComponent(id)}`);
  };

  const openAffine = async () => {
    if (!active) return;
    setBusy(true);
    const id = await ensureAffine();
    setBusy(false);
    if (id) setFrame(`/whiteboard?section=${SCOPE}&id=${encodeURIComponent(id)}`);
  };

  return (
    <div className="flex flex-1 w-full">
      <aside className="flex w-64 shrink-0 flex-col gap-1 border-r border-border bg-card/40 p-2">
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Projects
          </span>
          <Button size="xs" variant="outline" onClick={newProject}>
            <Plus className="size-3" /> New
          </Button>
        </div>
        <ScrollArea className="flex-1">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => selectProject(p.id)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent ${
                active?.id === p.id ? "bg-accent" : ""
              }`}
            >
              <FolderOpen className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{p.title}</span>
            </button>
          ))}
          {projects.length === 0 && (
            <p className="px-2 py-2 text-xs text-muted-foreground">No projects yet.</p>
          )}
        </ScrollArea>
      </aside>

      <main className="flex-1 p-6">
        {!active ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <p className="text-sm">Create or open a research project.</p>
            <Button onClick={newProject}>
              <Plus className="size-4" /> New Research Project
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h1 className="text-sm font-medium tracking-wide text-foreground/60 uppercase">
                Research Lab
              </h1>
              <p className="text-xs text-foreground/40">
                Dedicated project workspace. Notes autosave. Open a drawing app in a popup to sketch ideas.
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-foreground/50">Project title</label>
              <Input
                value={active.title}
                onChange={(e) => setActive({ ...active, title: e.target.value })}
                onBlur={() => patch({ title: active.title })}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Brief &amp; Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="What are you researching? Hypotheses, key questions…"
                  value={active.description}
                  onChange={(e) => setActive({ ...active, description: e.target.value })}
                  onBlur={() => patch({ description: active.description })}
                  rows={5}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Links, references, raw material for this project…"
                  value={active.sources}
                  onChange={(e) => setActive({ ...active, sources: e.target.value })}
                  onBlur={() => patch({ sources: active.sources })}
                  rows={4}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Research with an app</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    className="h-24 flex-col gap-2"
                    onClick={openExcel}
                    disabled={busy}
                  >
                    <PenTool className="size-6" /> Excel Draw
                  </Button>
                  <Button
                    variant="outline"
                    className="h-24 flex-col gap-2"
                    onClick={openAffine}
                    disabled={busy}
                  >
                    <LayoutGrid className="size-6" /> Affine
                  </Button>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Opens as an embedded popup — not a new browser window.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <AppFrameDialog url={frame} onClose={() => setFrame(null)} title="Research app" />
    </div>
  );
}
