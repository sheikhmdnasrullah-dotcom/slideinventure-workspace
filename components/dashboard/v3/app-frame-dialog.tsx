"use client";

import { useCallback, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

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
      <DialogContent className="w-[100vw] h-[100vh] max-w-[100vw] max-h-[100vh] p-0 gap-0 border-0 rounded-none bg-background">
        {url && (
          <iframe
            ref={iframeRef}
            src={url}
            title={title ?? "App"}
            className="h-full w-full border-0"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
