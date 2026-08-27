"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { AvFiles } from "./av-files";
import { AvPdfAsk } from "./av-pdf-ask";
import { AvSearch } from "./av-search";
import { FolderOpen, Plus } from "lucide-react";

type Tool = "files" | "pdf" | "search" | "whiteboard";

const TOOLS: { id: Tool; label: string }[] = [
  { id: "files", label: "Files" },
  { id: "pdf", label: "PDF Ask" },
  { id: "search", label: "Search" },
  { id: "whiteboard", label: "Whiteboard" },
];

type Board = { id: string; title: string };

export function AiVentureWorkspace() {
  const [tool, setTool] = useState<Tool>("files");
  const [boards, setBoards] = useState<Board[]>([]);
  const [whiteboardUrl, setWhiteboardUrl] = useState<string | null>(null);

  const loadBoards = useCallback(async () => {
    const res = await fetch(`/api/affine?section=concepts`);
    const json = await res.json();
    setBoards(json.workspaces ?? []);
  }, []);

  useEffect(() => {
    if (tool === "whiteboard") loadBoards();
  }, [tool, loadBoards]);

  const openWhiteboard = (id?: string) => {
    const url = `/whiteboard?section=concepts${id ? `&id=${encodeURIComponent(id)}` : ""}`;
    setWhiteboardUrl(url);
  };

  const createBoard = async () => {
    const res = await fetch("/api/affine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: "concepts", title: "Untitled" }),
    });
    const json = await res.json();
    if (json.workspace) {
      setBoards((prev) => [...prev, json.workspace]);
      openWhiteboard(json.workspace.id);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full">
      <aside className="flex w-48 shrink-0 flex-col gap-1 border-r border-border bg-card/40 p-2">
        <span className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          AI Venture
        </span>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            className={`rounded-md px-3 py-2 text-left text-sm hover:bg-accent ${tool === t.id ? "bg-accent" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </aside>

      <main className="flex-1 p-4">
        {tool === "files" && <AvFiles />}
        {tool === "pdf" && <AvPdfAsk />}
        {tool === "search" && <AvSearch />}
        {tool === "whiteboard" && (
          <div className="flex h-full flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">AFFiNE Whiteboard</h2>
              <Button size="sm" onClick={createBoard}>
                <Plus className="size-3" /> New board
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Boards open inside the dashboard. Your work is saved automatically.
            </p>
            <ScrollArea className="flex-1">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {boards.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => openWhiteboard(b.id)}
                    className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border p-4 text-sm hover:bg-accent"
                  >
                    <FolderOpen className="size-8 text-muted-foreground" />
                    <span className="line-clamp-1 text-center">{b.title}</span>
                  </button>
                ))}
                {boards.length === 0 && (
                  <p className="col-span-full text-xs text-muted-foreground">No whiteboards yet — create one.</p>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </main>

      <Dialog open={!!whiteboardUrl} onOpenChange={(open) => { if (!open) setWhiteboardUrl(null); }}>
        <DialogContent className="sm:max-w-[95vw] h-[90vh] p-0">
          {whiteboardUrl && (
            <iframe src={whiteboardUrl} className="h-full w-full rounded-lg border-0" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
