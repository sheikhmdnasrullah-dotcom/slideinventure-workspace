"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  Beaker,
  BookOpen,
  Bot,
  Cable,
  FileText,
  Grid,
  LayoutDashboard,
  Lightbulb,
  Link2,
  Lock,
  Mail,
  MessageSquare,
  NotebookPen,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Send,
  Settings,
  Sparkles,
  Target,
  Terminal,
  Users,
  Workflow,
} from "lucide-react";
import { commandMenuStore, useCommandMenu } from "@/lib/command-menu-store";
import { cn } from "@/lib/utils";

type CmdEntry = {
  id: string;
  label: string;
  hint?: string;
  group: "Results" | "Create" | "Navigate" | "Actions";
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
};

type SearchResult = {
  id: string;
  type: string;
  label: string;
  title: string;
  subtitle: string;
  href: string;
  updatedAt: string;
};

const NAV_ENTRIES: Omit<CmdEntry, "run">[] = [
  { id: "nav-dashboard", label: "Command Center", group: "Navigate", icon: LayoutDashboard, hint: "/dashboard" },
  { id: "nav-activity", label: "Activity", group: "Navigate", icon: Activity, hint: "/activity" },
  { id: "nav-knowledge", label: "Knowledge", group: "Navigate", icon: BookOpen, hint: "/knowledge" },
  { id: "nav-leads", label: "Leads", group: "Navigate", icon: Users, hint: "/leads" },
  { id: "nav-documents", label: "Documents", group: "Navigate", icon: FileText, hint: "/documents" },
  { id: "nav-links", label: "Useful Links", group: "Navigate", icon: Link2, hint: "/useful-links" },
  { id: "nav-research", label: "Research", group: "Navigate", icon: Beaker, hint: "/research-lab" },
  { id: "nav-brainstorm", label: "Brainstorm", group: "Navigate", icon: Lightbulb, hint: "/brainstorm-sketch" },
  { id: "nav-ai-venture", label: "Concepts", group: "Navigate", icon: Rocket, hint: "/concepts" },
  { id: "nav-terminal", label: "Terminal", group: "Navigate", icon: Terminal, hint: "/terminal" },
  { id: "nav-todoist", label: "Todoist", group: "Navigate", icon: Workflow, hint: "/todoist" },
  { id: "nav-notes", label: "Notes", group: "Navigate", icon: NotebookPen, hint: "/notepad" },
  { id: "nav-chat", label: "Chat", group: "Navigate", icon: MessageSquare, hint: "/chat" },
  { id: "nav-vault", label: "Vault", group: "Navigate", icon: Lock, hint: "/vault" },
  { id: "nav-mail", label: "Mail", group: "Navigate", icon: Mail, hint: "/mail" },
  { id: "nav-insights", label: "Insights", group: "Navigate", icon: Target, hint: "/insights" },
  { id: "nav-strategy", label: "Strategy", group: "Navigate", icon: Target, hint: "/strategy" },
  { id: "nav-agents", label: "Agents", group: "Navigate", icon: Bot, hint: "/agents" },
  { id: "nav-integrations", label: "Integrations", group: "Navigate", icon: Cable, hint: "/integrations" },
  { id: "nav-automations", label: "Automations", group: "Navigate", icon: Workflow, hint: "/automations" },
  { id: "nav-apps", label: "Apps", group: "Navigate", icon: Grid, hint: "/apps" },
  { id: "nav-settings", label: "Settings", group: "Navigate", icon: Settings, hint: "/settings" },
];

const SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  knowledge: BookOpen,
  leads: Users,
  documents: FileText,
  links: Link2,
  research: Beaker,
  boards: Lightbulb,
  ai_venture: Rocket,
  terminal: Terminal,
  todoist: Workflow,
  notes: NotebookPen,
  chat: MessageSquare,
};

export function CommandMenu() {
  const open = useCommandMenu((s) => s.open);

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

  if (!open) return null;
  return <CommandMenuInner />;
}

async function createAndGo(
  router: ReturnType<typeof useRouter>,
  api: string,
  body: Record<string, unknown>,
  idPath: (d: any) => string | undefined,
  fallback: string
) {
  try {
    const res = await fetch(api, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    const id = idPath(data);
    router.push(id ? `${fallback}?id=${encodeURIComponent(id)}` : fallback);
  } catch {
    router.push(fallback);
  }
}

function CommandMenuInner() {
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      commandMenuStore.close();
    }
  }, [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") commandMenuStore.close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Debounced global search across every section.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        setResults(Array.isArray(json.results) ? json.results : []);
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const navEntries = useMemo<CmdEntry[]>(
    () => NAV_ENTRIES.map((e) => ({ ...e, run: () => router.push(e.hint!) })),
    [router]
  );

  const createEntries = useMemo<CmdEntry[]>(
    () => [
      {
        id: "create-research",
        label: "New Research",
        hint: "blank workspace",
        group: "Create",
        icon: Beaker,
        run: () => createAndGo(router, "/api/research", { scope: "global" }, (d) => d.workspace?.id, "/research-lab"),
      },
      {
        id: "create-board",
        label: "New Board",
        hint: "brainstorm canvas",
        group: "Create",
        icon: Lightbulb,
        run: () => createAndGo(router, "/api/boards", { title: "Untitled Board", scope: "global" }, (d) => d.board?.id, "/brainstorm-sketch"),
      },
      { id: "create-note", label: "New Note", hint: "open editor", group: "Create", icon: NotebookPen, run: () => router.push("/notepad?new=1") },
      { id: "create-lead", label: "New Lead", hint: "open form", group: "Create", icon: Users, run: () => router.push("/leads?new=1") },
      { id: "create-link", label: "New Link", hint: "open form", group: "Create", icon: Link2, run: () => router.push("/useful-links?new=1") },
      { id: "create-chat", label: "New Chat", hint: "start conversation", group: "Create", icon: MessageSquare, run: () => router.push("/chat") },
    ],
    [router]
  );

  const actionEntries = useMemo<CmdEntry[]>(
    () => [
      {
        id: "act-sync",
        label: "Sync knowledge base",
        hint: "npm run sync",
        group: "Actions",
        icon: RefreshCw,
        run: () => router.push("/knowledge?sync=1"),
      },
    ],
    [router]
  );

  const searchEntries = useMemo<CmdEntry[]>(
    () =>
      results.map((r) => ({
        id: `res-${r.type}-${r.id}`,
        label: r.title,
        hint: r.subtitle ? `${r.label} · ${r.subtitle}` : r.label,
        group: "Results" as const,
        icon: SECTION_ICONS[r.type] ?? Search,
        run: () => router.push(r.href),
      })),
    [results, router]
  );

  const filtered = useMemo<CmdEntry[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...createEntries, ...navEntries, ...actionEntries];
    const local = [...createEntries, ...navEntries, ...actionEntries].filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        e.hint?.toLowerCase().includes(q) ||
        e.group.toLowerCase().includes(q)
    );
    return [...searchEntries, ...local];
  }, [query, searchEntries, createEntries, navEntries, actionEntries]);

  const safeActive = Math.min(active, Math.max(0, filtered.length - 1));

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
  const groupOrder: CmdEntry["group"][] = ["Results", "Create", "Navigate", "Actions"];
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
            placeholder="Search everything · create · navigate · run…"
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
                  Try a page name, a section, or a term to search across all modules.
                </span>
              )}
            </p>
          ) : (
            groupOrder.map((group) =>
              grouped[group]?.length ? (
                <div key={group} className="mb-1">
                  <div className="flex items-center gap-2 px-2 py-1 font-label text-ink-faint">
                    {group === "Create" && <Plus className="size-3" />}
                    {group === "Results" && <Search className="size-3" />}
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
                        {group === "Results" && (
                          <ArrowRight className="size-3 shrink-0 text-ink-faint" />
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
