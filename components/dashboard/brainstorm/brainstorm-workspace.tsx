"use client";

import { useCallback, useEffect, useState } from "react";
import { LayoutGrid, PenTool, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppFrameDialog } from "@/components/dashboard/v3/app-frame-dialog";

type Doc = { id: string; title: string };

const SECTION = "brainstorm";

export function BrainstormWorkspace() {
  const [excel, setExcel] = useState<Doc[]>([]);
  const [affine, setAffine] = useState<Doc[]>([]);
  const [frame, setFrame] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [b, a] = await Promise.all([
      fetch(`/api/boards?scope=${SECTION}`).then((r) => r.json()),
      fetch(`/api/affine?section=${SECTION}`).then((r) => r.json()),
    ]);
    setExcel((b.boards ?? []).map((x: any) => ({ id: x.id, title: x.title || "Untitled" })));
    setAffine((a.workspaces ?? []).map((x: any) => ({ id: x.id, title: x.title || "Untitled" })));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const newExcel = async () => {
    const res = await fetch("/api/boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled", scope: SECTION }),
    });
    const json = await res.json();
    if (json.board) {
      setExcel((p) => [...p, { id: json.board.id, title: json.board.title || "Untitled" }]);
      setFrame(`/excalidraw?scope=${SECTION}&id=${encodeURIComponent(json.board.id)}`);
    }
  };

  const newAffine = async () => {
    const res = await fetch("/api/affine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: SECTION, title: "Untitled" }),
    });
    const json = await res.json();
    if (json.workspace) {
      setAffine((p) => [...p, { id: json.workspace.id, title: json.workspace.title || "Untitled" }]);
      setFrame(`/whiteboard?section=${SECTION}&id=${encodeURIComponent(json.workspace.id)}`);
    }
  };

  const openExcel = (id: string) => setFrame(`/excalidraw?scope=${SECTION}&id=${encodeURIComponent(id)}`);
  const openAffine = (id: string) => setFrame(`/whiteboard?section=${SECTION}&id=${encodeURIComponent(id)}`);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-sm font-medium tracking-wide text-foreground/60 uppercase">Brainstorm</h1>
        <p className="text-xs text-foreground/40">
          Two apps, side by side. Pick either and start working — everything autosaves.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <PenTool className="size-4" /> Excel Draw
            </CardTitle>
            <Button size="sm" onClick={newExcel}>
              <Plus className="size-3" /> New
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-72">
              <div className="flex flex-col gap-1">
                {excel.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => openExcel(d.id)}
                    className="rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    {d.title}
                  </button>
                ))}
                {excel.length === 0 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">No drawings yet.</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutGrid className="size-4" /> Affine
            </CardTitle>
            <Button size="sm" onClick={newAffine}>
              <Plus className="size-3" /> New
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-72">
              <div className="flex flex-col gap-1">
                {affine.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => openAffine(d.id)}
                    className="rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    {d.title}
                  </button>
                ))}
                {affine.length === 0 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">No boards yet.</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <AppFrameDialog url={frame} onClose={() => setFrame(null)} title="Brainstorm app" />
    </div>
  );
}
