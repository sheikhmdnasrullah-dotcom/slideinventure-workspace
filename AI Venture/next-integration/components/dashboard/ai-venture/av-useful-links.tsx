"use client";

import { useEffect } from "react";
import { LinksClient } from "@/app/(app)/useful-links/links-client";
import { Send } from "lucide-react";
import { registerContextProvider, unregisterContextProvider } from "@/lib/agents/context-registry";

export function AvUsefulLinks() {
  // Expose the curated links to the deployed agent so dropping it here hands it
  // the real list, not just the section title.
  useEffect(() => {
    let active = true
    fetch("/api/links?pageSize=200")
      .then((r) => r.json())
      .then((json) => {
        if (!active) return
        const links: Array<{ title?: string; url?: string; description?: string; tags?: string[] }> =
          json.data ?? []
        const content = links
          .map((l) => {
            const head = l.title || l.url || "Link"
            const tail = [l.description, l.tags?.length ? `[${(l.tags || []).join(", ")}]` : "", l.url]
              .filter(Boolean)
              .join(" ")
            return `- ${head}${tail ? ": ${tail}" : ""}`
          })
          .join("\n")
        if (content) {
          registerContextProvider("useful-links", () => ({ title: "Useful Links", content }))
        }
      })
      .catch(() => {})
    return () => {
      active = false
      unregisterContextProvider("useful-links")
    }
  }, [])

  return (
    <div
      data-droppable="useful-links"
      data-drop-title="Useful Links"
      className="flex-1 overflow-y-auto p-6"
      data-lenis-prevent
    >
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
