"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AvFiles } from "./av-files";
import { AvPdfAsk } from "./av-pdf-ask";
import { AvSearch } from "./av-search";

type Tool = "files" | "pdf" | "search" | "whiteboard";

const TOOLS: { id: Tool; label: string }[] = [
  { id: "files", label: "Files" },
  { id: "pdf", label: "PDF Ask" },
  { id: "search", label: "Search" },
  { id: "whiteboard", label: "Whiteboard" },
];

type Board = { id: string; title: string };

function openWhiteboard(id?: string) {
  const url = `/whiteboard?section=concepts${id ? `&id=${encodeURIComponent(id)}` : ""}`;
  window.open(url, "_blank", "width=1440,height=900");
}

export function AiVentureWorkspace() {
  const [tool, setTool] = useState<Tool>("files");
  const [boards, setBoards] = useState<Board[]>([]);

  const loadBoards = useCallback(async () => {
    const res = await fetch(`/api/affine?section=concepts`);
    const json = await res.json();
    setBoards(json.workspaces ?? []);
  }, []);

  useEffect(() => {
    if (tool === "whiteboard") loadBoards();
  }, [tool, loadBoards]);

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
              <Button size="sm" onClick={() => openWhiteboard()}>
                New whiteboard
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Opens in a dedicated window. Your boards are saved automatically per session.
            </p>
            <ScrollArea className="flex-1">
              <div className="flex flex-col gap-2">
                {boards.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => openWhiteboard(b.id)}
                    className="rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    {b.title}
                  </button>
                ))}
                {boards.length === 0 && (
                  <p className="text-xs text-muted-foreground">No whiteboards yet — create one.</p>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </main>
    </div>
  );
}
