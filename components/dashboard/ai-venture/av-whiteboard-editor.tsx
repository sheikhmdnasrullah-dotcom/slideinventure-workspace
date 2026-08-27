"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCanvasAutosave } from "@/components/dashboard/v3/whiteboard/use-canvas-autosave";
import { SaveIndicator } from "@/components/dashboard/v3/whiteboard/save-indicator";

const ExcalidrawCanvas = dynamic(() => import("@/components/dashboard/v3/whiteboard/Whiteboard"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading canvas</div>,
});
const BlocksuiteEditor = dynamic(() => import("@/components/dashboard/v3/blocksuite/blocksuite-editor"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading editor</div>,
});

export type BoardEngine = "excalidraw" | "affine";

export const AFFINE_SECTION = "concepts"; // preserves boards created before this rewrite

type AvPayload = {
  content?: string;
  title?: string;
  snapshot?: Record<string, unknown>;
  section?: string;
};

export function AvWhiteboardEditor({
  engine,
  boardId,
  onBack,
}: {
  engine: BoardEngine;
  boardId: string;
  onBack: () => void;
}) {
  const [title, setTitle] = useState("Untitled");
  const [excalidrawData, setExcalidrawData] = useState<string>("{}");
  const [affineSnapshot, setAffineSnapshot] = useState<Record<string, unknown> | null>(null);
  const [ready, setReady] = useState(false);
  const engineRef = useRef(engine);
  const boardIdRef = useRef(boardId);
  engineRef.current = engine;
  boardIdRef.current = boardId;

  useEffect(() => {
    setReady(false);
    (async () => {
      if (engine === "excalidraw") {
        const res = await fetch(`/api/boards/${boardId}`);
        const json = await res.json();
        setExcalidrawData(json.board?.content ?? "{}");
        setTitle(json.board?.title || "Untitled");
      } else {
        const res = await fetch(`/api/affine/${boardId}`);
        const json = await res.json();
        setAffineSnapshot(json.workspace?.snapshot ?? null);
        setTitle(json.workspace?.title || "Untitled");
      }
      setReady(true);
    })();
  }, [engine, boardId]);

  const { state, lastSavedAt, queue, flush } = useCanvasAutosave<AvPayload>({
    delay: 500,
    merge: (prev, next) => ({ ...prev, ...next }),
    save: async (payload) => {
      const id = boardIdRef.current;
      if (!id) return;
      if (engineRef.current === "excalidraw") {
        await fetch(`/api/boards/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch(`/api/affine/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, section: AFFINE_SECTION }),
        });
      }
    },
    beacon: (payload) => {
      const id = boardIdRef.current;
      if (!id) return null;
      const url =
        engineRef.current === "excalidraw"
          ? `/api/boards/${id}`
          : `/api/affine/${id}`;
      return {
        url,
        method: "PUT",
        body: JSON.stringify(
          engineRef.current === "excalidraw"
            ? payload
            : { ...payload, section: AFFINE_SECTION }
        ),
      };
    },
  });

  const saveTitle = useCallback(
    (next: string) => {
      setTitle(next);
      queue({ title: next });
    },
    [queue]
  );

  // Flush when embedded in an iframe modal and the parent requests close.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "canvas:flush") {
        flush().finally(() => {
          try {
            (e.source as Window | null)?.postMessage?.({ type: "canvas:flushed" }, e.origin);
          } catch {
            // ignore
          }
          window.parent.postMessage({ type: "canvas:flushed" }, window.location.origin);
        });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [flush]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Button size="icon-sm" variant="ghost" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <Input
          value={title}
          onChange={(e) => saveTitle(e.target.value)}
          onBlur={() => {
            flush();
          }}
          className="h-8 w-64 text-sm"
        />
        <SaveIndicator state={state} lastSavedAt={lastSavedAt} onRetry={() => flush()} />
      </div>
      <div className="relative flex-1">
        {!ready ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading board</div>
        ) : engine === "excalidraw" ? (
          <ExcalidrawCanvas
            key={boardId}
            initialData={excalidrawData}
            onChange={(snapshot: string) => queue({ content: snapshot })}
            onMount={() => {}}
          />
        ) : (
          <BlocksuiteEditor
            key={boardId}
            snapshot={affineSnapshot}
            mode="edgeless"
            onChange={(snapshot) => queue({ snapshot })}
          />
        )}
      </div>
    </div>
  );
}
