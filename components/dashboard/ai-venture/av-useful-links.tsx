"use client";

import { LinksClient } from "@/app/(app)/useful-links/links-client";
import { Send } from "lucide-react";

export function AvUsefulLinks() {
  return (
    <div className="flex-1 overflow-y-auto p-6" data-lenis-prevent>
      <div className="flex items-center justify-between gap-4 border-b border-rule pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Send className="size-5" />
          </div>
          <div>
            <h2 className="font-label text-base font-semibold text-ink-strong">
              Useful Links
            </h2>
            <p className="text-xs text-ink-muted">
              Curated bookmarks, tools, references, and APIs dedicated to AI Venture.
            </p>
          </div>
        </div>
      </div>

      <LinksClient scope="ai-venture" />
    </div>
  );
}
