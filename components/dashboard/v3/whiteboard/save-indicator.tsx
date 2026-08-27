"use client";

import { AlertTriangle, Check, Loader2, Pencil } from "lucide-react";
import type { SaveState } from "./use-canvas-autosave";

function relativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function SaveIndicator({
  state,
  lastSavedAt,
  onRetry,
}: {
  state: SaveState;
  lastSavedAt: Date | null;
  onRetry?: () => void;
}) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Saving
      </span>
    );
  }

  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <AlertTriangle className="size-3.5" />
        Save failed
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-sm underline underline-offset-2 hover:text-foreground"
          >
            Retry
          </button>
        )}
      </span>
    );
  }

  if (state === "dirty") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Pencil className="size-3.5" />
        Unsaved changes
      </span>
    );
  }

  if (state === "saved" && lastSavedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Check className="size-3.5" />
        Saved {relativeTime(lastSavedAt)}
      </span>
    );
  }

  return null;
}
