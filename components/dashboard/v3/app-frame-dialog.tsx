"use client";

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
  return (
    <Dialog open={!!url} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[95vw] h-[90vh] p-0">
        {url && (
          <iframe
            src={url}
            title={title ?? "App"}
            className="h-full w-full rounded-lg border-0"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
