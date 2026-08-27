"use client";

import * as React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Maximize2, X } from "lucide-react";

export function PdfEditorDialog({
  open,
  onClose,
  fileUrl,
  title,
}: {
  open: boolean;
  onClose: () => void;
  fileUrl?: string | null;
  title?: string;
}) {
  // Open Stirling-PDF (self-hosted, proxied same-origin so it can be embedded
  // as a full-screen popup). The user uploads/opens a file inside the editor.
  const src = "/api/pdf";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[100vw] h-[100vh] max-w-[100vw] max-h-[100vh] p-0 gap-0 border-0 rounded-none bg-background">
        <div className="absolute right-3 top-3 z-10 flex gap-2">
          {title && (
            <span className="rounded bg-black/50 px-2 py-1 text-xs text-white">{title}</span>
          )}
          <Button size="icon-sm" variant="secondary" onClick={onClose} title="Close">
            <X className="size-4" />
          </Button>
        </div>
        {open && (
          <iframe src={src} title="PDF editor" className="h-full w-full border-0" />
        )}
      </DialogContent>
    </Dialog>
  );
}
