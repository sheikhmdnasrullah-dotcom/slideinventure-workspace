"use client";

import { useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function AppFrameDialog({
  url,
  onClose,
  title,
}: {
  url: string | null;
  onClose: () => void;
  title?: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const closingRef = useRef(false);

  // On close request, ask the embedded canvas to flush any pending save first,
  // then wait for a `canvas:flushed` acknowledgement (with a timeout) before
  // tearing down the iframe. If the child never answers, close anyway.
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    const win = iframeRef.current?.contentWindow;
    if (!win) {
      onClose();
      return;
    }

    closingRef.current = true;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
      closingRef.current = false;
      onClose();
    };

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "canvas:flushed") finish();
    };

    const timer = setTimeout(finish, 1200);
    window.addEventListener("message", onMessage);

    try {
      win.postMessage({ type: "canvas:flush" }, window.location.origin);
    } catch {
      finish();
    }
  }, [onClose]);

  // If the whole parent page is going away, signal the child to flush too.
  useEffect(() => {
    const onBeforeUnload = () => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "canvas:flush" },
        window.location.origin
      );
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  return (
    <Dialog open={!!url} onOpenChange={(open) => { if (!open) requestClose(); }}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[92vh] w-[94vw] max-w-[1400px] flex-col gap-0 overflow-hidden rounded-md border border-rule-strong bg-[var(--surface)] p-0 shadow-overlay"
      >
        <div className="flex h-10 shrink-0 items-center gap-3 border-b border-rule bg-[var(--surface-2)] px-3">
          <span className="flex items-center gap-1.5" aria-hidden>
            <span className="size-2 rounded-full bg-rule-strong" />
            <span className="size-2 rounded-full bg-rule-strong" />
            <span className="size-2 rounded-full bg-rule-strong" />
          </span>
          <span className="font-label text-ink-faint">{title ?? "App"}</span>
          <DialogClose
            render={
              <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="Close" />
            }
          >
            <X className="size-3.5" />
          </DialogClose>
        </div>
        <div className="min-h-0 flex-1">
          {url && (
            <iframe
              ref={iframeRef}
              src={url}
              title={title ?? "App"}
              className="h-full w-full border-0"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
