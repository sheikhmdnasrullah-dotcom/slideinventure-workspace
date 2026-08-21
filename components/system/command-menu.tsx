"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BookOpen,
  Cable,
  LayoutDashboard,
  Lightbulb,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  Terminal,
} from "lucide-react";
import { commandMenuStore, useCommandMenu } from "@/lib/command-menu-store";
import { cn } from "@/lib/utils";

/**
 * ⌘K command menu — the single global surface that replaces the floating
 * KnowledgeChatWidget FAB. Four intents share one UI:
 *
 *   navigate  pages (and, later, entities)   ↵ router.push
 *   search    delegates to /api/knowledge/search (Phase E lands the integrated
 *             evidence view; today the user can still type and filter)
 *   ask       RAG answer via /api/chat (Phase G; placeholder intent today)
 *   actions   sync / run task / new decision (route push or server action)
 *
 * Design note: the inner component mounts fresh every time the menu opens, so
 * query/active state initialises from useState defaults — no effect-driven
 * setState that would trip React 19's `react-hooks/set-state-in-effect` rule.
 */

type CmdEntry = {
  id: string;
  label: string;
  hint?: string;
  group: "Navigate" | "Actions";
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
};

const NAV_ENTRIES: Omit<CmdEntry, "run">[] = [
  { id: "nav-home", label: "Command Center", group: "Navigate", icon: LayoutDashboard, hint: "/" },
  { id: "nav-activity", label: "Activity", group: "Navigate", icon: Activity, hint: "/activity" },
  { id: "nav-knowledge", label: "Knowledge", group: "Navigate", icon: BookOpen, hint: "/knowledge" },
  { id: "nav-prospects", label: "Prospects", group: "Navigate", icon: Target, hint: "/prospects" },
  { id: "nav-outreach", label: "Outreach", group: "Navigate", icon: Send, hint: "/cold-outreach" },
  { id: "nav-strategy", label: "Strategy", group: "Navigate", icon: Sparkles, hint: "/strategy" },
  { id: "nav-research", label: "Research", group: "Navigate", icon: BookOpen, hint: "/research" },
  { id: "nav-insights", label: "Insights", group: "Navigate", icon: Lightbulb, hint: "/insights" },
  { id: "nav-agents", label: "Agents", group: "Navigate", icon: Terminal, hint: "/agents" },
  { id: "nav-integrations", label: "Integrations", group: "Navigate", icon: Cable, hint: "/automations" },
];

export function CommandMenu() {
  const open = useCommandMenu((s) => s.open);

  // Global ⌘K / Ctrl-K. Stops the browser's default Cmd-K and toggles the menu.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        commandMenuStore.toggle();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Mount the inner component only while open. Because <CommandMenuInner/>
  // unmounts on close, all of its query/active state initialises fresh on the
  // next open via useState defaults — no effect-setState, no stale carryover.
  if (!open) return null;
  return <CommandMenuInner />;
}

function CommandMenuInner() {
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  // Focus the input when the inner component first mounts. No setState here —
  // we're imperatively focusing a DOM node, which is exactly what effects are
  // for. The query state stays untouched.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on route change. A navigate-to-route action does close() via this
  // effect's dependency on pathname; a query-driven search does NOT change
  // pathname, so the menu stays open while the user reads results.
  useEffect(() => {
    // Skip the first mount — we don't want to close the menu the instant it
    // opens. We only want to close on a LATER pathname change.
    if (inputRef.current && document.activeElement !== inputRef.current) {
      commandMenuStore.close();
    }
  }, [pathname]);

  // Escape closes the menu cleanly.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") commandMenuStore.close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const entries = useMemo<CmdEntry[]>(() => {
    const nav = NAV_ENTRIES.map((e) => ({
      ...e,
      run: () => router.push(e.hint!),
    }));
    const actions: CmdEntry[] = [
      {
        id: "act-sync",
        label: "Sync knowledge base",
        hint: "npm run sync",
        group: "Actions",
        icon: RefreshCw,
        run: () => router.push("/knowledge?sync=1"),
      },
    ];
    return [...nav, ...actions];
  }, [router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        e.hint?.toLowerCase().includes(q) ||
        e.group.toLowerCase().includes(q)
    );
  }, [entries, query]);

  // Derive a clamped active index at render time — no setState in effect.
  // When the user types and filtered shrinks, safeActive auto-corrects
  // without touching state. Keyboard handlers and onMouseEnter mutate `active`;
  // safeActive is used for rendering + Enter execution.
  const safeActive = Math.min(active, Math.max(0, filtered.length - 1));

  // Attach an arrow-nav handler to the input. Keystrokes the input should
  // handle itself (typing) are left alone.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[safeActive]?.run();
    }
  }

  const grouped = filtered.reduce<Record<string, CmdEntry[]>>((acc, e) => {
    (acc[e.group] ||= []).push(e);
    return acc;
  }, {});
  const groupOrder: CmdEntry["group"][] = ["Navigate", "Actions"];
  let flatIndex = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--scrim)] px-4 pt-[12vh] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Command menu"
      onClick={() => commandMenuStore.close()}
    >
      <div
        className="flex w-full max-w-xl flex-col overflow-hidden rounded-md border border-rule-strong bg-popover shadow-overlay"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-rule px-4">
          <Sparkles className="size-4 shrink-0 text-flame" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask · search · navigate · run…"
            className="h-12 flex-1 bg-transparent font-body text-base text-ink-strong outline-none placeholder:text-ink-faint"
            aria-label="Command input"
            aria-controls="command-list"
            aria-activedescendant={filtered[active] ? `cmd-${filtered[active].id}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden h-5 items-center rounded-xs border border-rule bg-[var(--surface-2)] px-1 font-mono text-[10px] text-ink-faint sm:inline-flex">
            ESC
          </kbd>
        </div>

        <div id="command-list" className="max-h-[60vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center font-body text-sm text-ink-muted">
              No matches for &ldquo;{query}&rdquo;.
              {query.length > 2 && (
                <span className="mt-1 block text-xs text-ink-faint">
                  Try a page name, a route, or &ldquo;sync&rdquo;.
                </span>
              )}
            </p>
          ) : (
            groupOrder.map((group) =>
              grouped[group]?.length ? (
                <div key={group} className="mb-1">
                  <div className="px-2 py-1 font-label text-ink-faint">
                    {group}
                  </div>
                  {grouped[group].map((entry) => {
                    flatIndex += 1;
                    const idx = flatIndex;
                    const isActive = idx === safeActive;
                    return (
                      <button
                        key={entry.id}
                        id={`cmd-${entry.id}`}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onMouseEnter={() => setActive(idx)}
                        onClick={entry.run}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-sm px-2 py-2 text-left transition-colors",
                          isActive
                            ? "bg-[var(--accent-wash)] text-ink-strong"
                            : "text-ink-default hover:bg-[var(--surface-2)]"
                        )}
                      >
                        <entry.icon
                          className={cn(
                            "size-4 shrink-0",
                            isActive ? "text-flame" : "text-ink-faint"
                          )}
                        />
                        <span className="flex-1 font-body text-sm">{entry.label}</span>
                        {entry.hint && (
                          <span className="font-label tabular-nums text-ink-faint">
                            {entry.hint}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : null
            )
          )}
        </div>

        <div className="flex items-center justify-between border-t border-rule px-3 py-2 font-label text-ink-faint">
          <span className="normal-case">
            <span className="text-flame">↵</span> open ·{" "}
            <span className="text-flame">↑↓</span> move ·{" "}
            <span className="text-flame">esc</span> close
          </span>
          <span className="normal-case">SlideIn Venture OS</span>
        </div>
      </div>
    </div>
  );
}
