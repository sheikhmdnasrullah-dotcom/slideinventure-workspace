"use client";

import { useEffect, useRef } from "react";
import { DocCollection, Job, Schema } from "@blocksuite/store";
import { AffineSchemas } from "@blocksuite/blocks";

export type AffineSnapshot = Record<string, unknown> | null;

// effects() calls customElements.define(...) for every AFFiNE/BlockSuite tag.
// Calling it more than once throws ("has already been used with this
// registry") — and this component remounts every time the user switches
// workspaces (snapshot/mode change), so it must run at most once per page.
let effectsRegistered: Promise<void> | null = null;
function ensureEffectsRegistered(): Promise<void> {
  if (!effectsRegistered) {
    effectsRegistered = Promise.all([
      import("@blocksuite/blocks/effects"),
      import("@blocksuite/presets/effects"),
    ]).then(([{ effects: blocksEffects }, { effects: presetsEffects }]) => {
      blocksEffects();
      presetsEffects();
    });
  }
  return effectsRegistered;
}

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
    let activeDoc: any = null;
    let detachListener: (() => void) | undefined;
    let job: Job | undefined;

    const flushSave = () => {
      if (!activeDoc || !job) return;
      try {
        const snap = job.docToSnapshot(activeDoc) as Record<string, unknown> | undefined;
        if (snap) onChange?.(snap);
      } catch {
        // ignore transient serialization errors
      }
    };

    const scheduleSave = () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(flushSave, 900);
    };

    // The autosave listener must always be attached to whichever Doc object
    // is actually being rendered/edited. Loading a snapshot produces a brand
    // new Doc instance distinct from any placeholder created earlier — a
    // previous version of this component attached the listener to a
    // throwaway blank doc before the snapshot finished restoring, so edits
    // to a *reopened* board (i.e. the restored doc) never fired it and were
    // silently lost. Always (re)bind after the real doc is known.
    const bindActiveDoc = (doc: any) => {
      detachListener?.();
      activeDoc = doc;
      try {
        const off = doc.slots?.blockUpdated?.on?.(scheduleSave);
        detachListener = () => {
          try {
            off?.();
          } catch {
            // ignore
          }
        };
      } catch {
        detachListener = undefined;
      }
    };

    (async () => {
      await ensureEffectsRegistered();

      const schema = new Schema();
      schema.register(AffineSchemas);
      const collection = new DocCollection({ schema });
      collection.meta.initialize();
      job = new Job({ collection });

      // Restore the snapshot FIRST when one exists, rather than bootstrapping
      // a blank doc and swapping it out afterward — that gap is exactly what
      // let edits land on the wrong (soon-to-be-discarded) doc.
      let doc: any = snapshot ? await job.snapshotToDoc(snapshot as any).catch(() => undefined) : undefined;

      if (!doc) {
        const docId = "doc-" + Math.random().toString(36).slice(2, 10);
        collection.createDoc({ id: docId });
        doc = collection.getDoc(docId);
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
      } else {
        doc.load();
      }

      if (disposed) return;

      const editor = document.createElement("affine-editor-container") as any;
      editorEl = editor;
      editor.doc = doc;
      editor.mode = mode;
      editor.style.height = "100%";
      editor.style.width = "100%";
      container.appendChild(editor);

      bindActiveDoc(doc);

      const onUnload = () => flushSave();
      window.addEventListener("beforeunload", onUnload);
      editorEl.__cleanup = () => window.removeEventListener("beforeunload", onUnload);
    })();

    return () => {
      disposed = true;
      if (saveTimer) clearTimeout(saveTimer);
      flushSave();
      detachListener?.();
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
