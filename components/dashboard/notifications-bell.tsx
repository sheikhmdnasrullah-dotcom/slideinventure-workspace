"use client";

import * as React from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";

type Notification = {
  id: string;
  category: string;
  title: string;
  description: string;
  entityId?: string;
  entityType?: string;
  read: boolean;
  createdAt?: string;
};

const SEEN_NOTIFS_KEY = "workspace_seen_notification_ids";

function getSeenIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(SEEN_NOTIFS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveSeenIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    const arr = Array.from(ids).slice(-200);
    localStorage.setItem(SEEN_NOTIFS_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

export function NotificationsBell() {
  const [unread, setUnread] = React.useState(0);
  const [items, setItems] = React.useState<Notification[]>([]);
  const [open, setOpen] = React.useState(false);
  const isInitialMount = React.useRef(true);
  const seenIdsRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    seenIdsRef.current = getSeenIds();
  }, []);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const list: Notification[] = data.notifications ?? [];
      setItems(list);
      const u = data.unread ?? 0;
      setUnread(u);

      if (isInitialMount.current) {
        // On initial page load/reload, mark all existing notifications as seen so they never toast
        isInitialMount.current = false;
        list.forEach((n) => seenIdsRef.current.add(n.id));
        saveSeenIds(seenIdsRef.current);
        return;
      }

      // Only toast truly new notifications that arrive while the user is actively on the page
      const freshUnseen = list.find((n) => !n.read && !seenIdsRef.current.has(n.id));
      if (freshUnseen) {
        seenIdsRef.current.add(freshUnseen.id);
        saveSeenIds(seenIdsRef.current);
        toast(freshUnseen.title, { description: freshUnseen.description });
      }
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const markAll = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
    load();
  };

  const markOne = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
    load();
  };

  const clearAll = async () => {
    setItems([]);
    setUnread(0);
    await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
    load();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative inline-flex size-8 items-center justify-center rounded-md border border-border hover:bg-accent"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-md border border-border bg-popover text-popover-foreground shadow-lg z-50">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-medium">Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Mark all read
              </button>
            )}
            {items.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                No notifications yet.
              </p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => markOne(n.id)}
                  className={`flex w-full flex-col items-start gap-0.5 border-b border-border/50 px-3 py-2 text-left hover:bg-accent ${
                    n.read ? "opacity-60" : ""
                  }`}
                >
                  <span className="text-sm font-medium">{n.title}</span>
                  {n.description && (
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {n.description}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
