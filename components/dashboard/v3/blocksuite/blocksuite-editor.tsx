"use client";

import { useEffect, useRef } from "react";
import { DocCollection, Job, Schema } from "@blocksuite/store";
import { AffineSchemas } from "@blocksuite/blocks";
import "@blocksuite/presets";

export type AffineSnapshot = Record<string, unknown> | null;

export default function BlocksuiteEditor({
  snapshot,
  onChange,
  mode = "page",
}: {
  snapshot: AffineSnapshot;
  onChange?: (snapshot: Record<string, unknown>) => void;
  mode?: "page" | "edgeless";
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let editorEl: any = null;
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    let saveFn: (() => void) | undefined;

    (async () => {
      const schema = new Schema();
      schema.register(AffineSchemas);
      const collection = new DocCollection({ schema });
      collection.meta.initialize();
      const job = new Job({ collection });

      const docId = "doc-" + Math.random().toString(36).slice(2, 10);
      collection.createDoc({ id: docId });
      let doc: any = collection.getDoc(docId);
      if (!doc) {
        await new Promise<void>((resolve) => {
          const slot = (collection.slots as any)?.docAdded;
          const dispose = slot?.on?.((id: string) => {
            if (id === docId) {
              dispose?.();
              resolve();
            }
          });
          setTimeout(resolve, 1000);
        });
        doc = collection.getDoc(docId);
      }
      if (!doc) return;
      doc.load();
      try {
        if (!doc.root) {
          const pageId = doc.addBlock("affine:page", {} as never);
          if (mode === "edgeless") {
            doc.addBlock("affine:surface", {} as never, pageId as never);
          }
          doc.addBlock("affine:note", {} as never, pageId as never);
        }
      } catch {
        // editor can still bootstrap content on first edit
      }

      if (disposed) return;

      const editor = document.createElement("affine-editor-container") as any;
      editorEl = editor;
      editor.doc = doc;
      editor.mode = mode;
      editor.style.height = "100%";
      editor.style.width = "100%";
      container.appendChild(editor);

      saveFn = () => {
        try {
          const snap = job.docToSnapshot(doc) as Record<string, unknown> | undefined;
          if (snap) onChange?.(snap);
        } catch {
          // ignore transient serialization errors
        }
      };

      const scheduleSave = () => {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => saveFn?.(), 900);
      };

      try {
        (doc as any).slots?.updated?.on?.(scheduleSave);
      } catch {
        // slot api differs across versions
      }
      try {
        (collection as any).slots?.docUpdated?.on?.(scheduleSave);
      } catch {
        // slot api differs across versions
      }

      if (snapshot) {
        job
          .snapshotToDoc(snapshot as any)
          .then((restored: any) => {
            if (restored && !disposed) editor.doc = restored;
          })
          .catch(() => {});
      }

      const onUnload = () => saveFn?.();
      window.addEventListener("beforeunload", onUnload);
      editorEl.__cleanup = () => window.removeEventListener("beforeunload", onUnload);
    })();

    return () => {
      disposed = true;
      if (saveTimer) clearTimeout(saveTimer);
      try {
        saveFn?.();
      } catch {
        // ignore
      }
      if (editorEl) {
        try {
          editorEl.__cleanup?.();
        } catch {
          // ignore
        }
        if (editorEl.parentNode === container) container.removeChild(editorEl);
      }
    };
  }, [snapshot, mode, onChange]);

  return <div ref={containerRef} style={{ height: "100%", width: "100%" }} />;
}
