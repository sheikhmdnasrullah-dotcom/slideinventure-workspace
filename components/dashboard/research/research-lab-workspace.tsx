"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileText, FolderOpen, LayoutGrid, PenTool, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { AppFrameDialog } from "@/components/dashboard/v3/app-frame-dialog";
import { SiteHeader } from "@/components/dashboard/site-header";
import { EmptyState } from "@/components/system";
import { cn } from "@/lib/utils";

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
  const searchParams = useSearchParams();
  const initialId = searchParams.get("id");
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

  // If we landed here with ?id=... (e.g. command palette "New Research"),
  // open that project automatically once the list is loaded.
  useEffect(() => {
    if (!initialId || active) return;
    void selectProject(initialId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId, projects.length]);

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
      body: JSON.stringify({ title: `${active?.title || "Project"}: Excel Draw`, scope: SCOPE }),
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
      body: JSON.stringify({ section: SCOPE, title: `${active?.title || "Project"}: Affine` }),
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
    <>
      <SiteHeader crumbs={[{ label: "Research Lab" }]} subtitle="Active investigation" />
      <div className="flex flex-1 w-full">
        <aside className="flex w-64 shrink-0 flex-col gap-1 border-r border-rule bg-[var(--surface-2)]/40 p-2">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="font-label text-ink-faint">Projects</span>
            <Button size="xs" variant="outline" onClick={newProject}>
              <Plus className="size-3" /> New
            </Button>
          </div>
          <ScrollArea className="flex-1">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => selectProject(p.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left font-body-tight text-sm transition-colors hover:bg-[var(--surface-2)]",
                  active?.id === p.id ? "bg-[var(--surface-2)] text-ink-strong" : "text-ink-muted"
                )}
              >
                <FolderOpen className="size-3.5 shrink-0 text-ink-faint" />
                <span className="truncate">{p.title}</span>
              </button>
            ))}
            {projects.length === 0 && (
              <p className="px-2 py-2 font-body text-xs text-ink-muted">No projects yet.</p>
            )}
          </ScrollArea>
        </aside>

        <main className="flex-1 overflow-y-auto p-8" data-lenis-prevent>
          {!active ? (
            <EmptyState
              eyebrow="Research Lab"
              title="Research Workspace"
              description="Create or select a project to organize notes, collect sources, and track research."
              action={{
                label: (
                  <>
                    <Plus className="size-3.5" /> New research project
                  </>
                ),
                onClick: newProject,
              }}
            />
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-8">
              <div className="flex flex-col gap-1">
                <Input
                  value={active.title}
                  onChange={(e) => setActive({ ...active, title: e.target.value })}
                  onBlur={() => patch({ title: active.title })}
                  className="h-auto border-none bg-transparent px-0 font-display text-2xl text-ink-strong shadow-none focus-visible:ring-0"
                />
                <p className="font-body text-sm text-ink-muted">
                  Notes autosave. Sketch ideas in a tool without leaving this project.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <span className="font-label text-ink-faint">Brief &amp; notes</span>
                  <Textarea
                    placeholder="What are you researching? Hypotheses, key questions"
                    value={active.description}
                    onChange={(e) => setActive({ ...active, description: e.target.value })}
                    onBlur={() => patch({ description: active.description })}
                    rows={8}
                    className="resize-none border-rule bg-[var(--surface)]"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <span className="font-label text-ink-faint">Sources</span>
                  <Textarea
                    placeholder="Links, references, raw material for this project"
                    value={active.sources}
                    onChange={(e) => setActive({ ...active, sources: e.target.value })}
                    onBlur={() => patch({ sources: active.sources })}
                    rows={8}
                    className="resize-none border-rule bg-[var(--surface)]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-label text-ink-faint">Open a tool</span>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={openExcel}
                    disabled={busy}
                    className="motion-card flex items-center gap-2.5 rounded-md border border-rule bg-[var(--surface)] px-4 py-3 disabled:opacity-60"
                  >
                    <PenTool className="size-4 text-ink-muted" />
                    <span className="font-body-tight text-sm text-ink-strong">Sketch board</span>
                  </button>
                  <button
                    onClick={openAffine}
                    disabled={busy}
                    className="motion-card flex items-center gap-2.5 rounded-md border border-rule bg-[var(--surface)] px-4 py-3 disabled:opacity-60"
                  >
                    <LayoutGrid className="size-4 text-ink-muted" />
                    <span className="font-body-tight text-sm text-ink-strong">Whiteboard</span>
                  </button>
                </div>
                <p className="font-body text-xs text-ink-faint">
                  Opens as an embedded popup, not a new browser window.
                </p>
              </div>
            </div>
          )}
        </main>

        <AppFrameDialog url={frame} onClose={() => setFrame(null)} title="Research app" />
      </div>
    </>
  );
}
