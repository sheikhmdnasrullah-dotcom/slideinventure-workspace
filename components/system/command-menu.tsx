"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Beaker,
  BookOpen,
  Bot,
  Cable,
  Component,
  FileText,
  Grid,
  LayoutDashboard,
  Lightbulb,
  Link2,
  Lock,
  Mail,
  MessageSquare,
  NotebookPen,
  RefreshCw,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Terminal,
  Users,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { commandMenuStore, useCommandMenu } from "@/lib/command-menu-store";
import { useLiveRefresh } from "@/components/providers/event-stream";
import { cn } from "@/lib/utils";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";

type CmdEntry = {
  id: string;
  label: string;
  hint?: string;
  group: "Results" | "Recent" | "Create" | "Navigate" | "Actions";
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
  { id: "nav-email-crawler", label: "Email Crawler", group: "Navigate", icon: ShieldCheck, hint: "/email-crawler" },
  { id: "nav-agent-canvas", label: "Agent Canvas", group: "Navigate", icon: Workflow, hint: "/agent-canvas" },
  { id: "nav-analytics", label: "Analytics", group: "Navigate", icon: BarChart3, hint: "/analytics" },
  { id: "nav-ai-chat", label: "AI SDK Chat", group: "Navigate", icon: MessageSquare, hint: "/ai-chat" },
  { id: "nav-ui-kit", label: "UI Kit", group: "Navigate", icon: Component, hint: "/ui-kit" },
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
  dashboard: LayoutDashboard,
};

const RECENT_CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  knowledge: BookOpen,
  leads: Users,
  documents: FileText,
  links: Link2,
  vault: Lock,
  todoist: Workflow,
  notes: NotebookPen,
  terminal: Terminal,
  chat: MessageSquare,
  ai_venture: Rocket,
  concepts: Rocket,
  brainstorm: Lightbulb,
  agents: Bot,
  dashboard: LayoutDashboard,
};

const RECENT_CATEGORY_ROUTE: Record<string, string> = {
  knowledge: "/knowledge",
  leads: "/leads",
  documents: "/documents",
  links: "/useful-links",
  vault: "/vault",
  todoist: "/todoist",
  notes: "/notepad",
  terminal: "/terminal",
  chat: "/chat",
  ai_venture: "/concepts",
  concepts: "/concepts",
  brainstorm: "/brainstorm-sketch",
  agents: "/agents",
  dashboard: "/dashboard",
};

type RecentActivity = { id: string; title: string; category: string };

export function CommandMenu() {
  const open = useCommandMenu((s) => s.open);
  const pathname = usePathname();

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

  useEffect(() => {
    if (open) commandMenuStore.close();
  }, [pathname, open]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={(o) => (o ? commandMenuStore.open() : commandMenuStore.close())}
      shouldFilter={false}
    >
      <CommandMenuBody />
    </CommandDialog>
  );
}

async function createAndToast(
  router: ReturnType<typeof useRouter>,
  api: string,
  body: Record<string, unknown>,
  idPath: (d: any) => string | undefined,
  fallback: string,
  successMsg: string
) {
  try {
    const res = await fetch(api, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    const id = idPath(data);
    toast.success(successMsg);
    router.push(id ? `${fallback}?id=${encodeURIComponent(id)}` : fallback);
  } catch {
    toast.error("Could not complete that action");
    router.push(fallback);
  }
}

function CommandMenuBody() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState<RecentActivity[]>([]);

  useEffect(() => {
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const loadRecent = useMemo(
    () => () => {
      fetch("/api/activities?limit=6")
        .then((res) => res.json())
        .then((data) =>
          setRecent(Array.isArray(data.activities) ? data.activities : [])
        )
        .catch(() => setRecent([]));
    },
    []
  );

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  useLiveRefresh(loadRecent);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q)}`,
          { signal: controller.signal }
        );
        const json = await res.json();
        setResults(Array.isArray(json.results) ? json.results : []);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setResults([]);
      } finally {
        setSearching(false);
      }
    }, 180);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
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
        run: () =>
          createAndToast(
            router,
            "/api/affine",
            { section: "research" },
            (d) => d.workspace?.id,
            "/research-lab",
            "Research workspace created"
          ),
      },
      {
        id: "create-board",
        label: "New Board",
        hint: "brainstorm canvas",
        group: "Create",
        icon: Lightbulb,
        run: () =>
          createAndToast(
            router,
            "/api/boards",
            { title: "Untitled Board", scope: "global" },
            (d) => d.board?.id,
            "/brainstorm-sketch",
            "Board created"
          ),
      },
      {
        id: "create-idea-map",
        label: "New idea map",
        hint: "mind map canvas",
        group: "Create",
        icon: Lightbulb,
        run: () =>
          createAndToast(
            router,
            "/api/idea-maps",
            {},
            (d) => d.map?.id,
            "/brainstorm-sketch",
            "Idea map created"
          ),
      },
      {
        id: "create-brainstorm-board",
        label: "New brainstorm board",
        hint: "brainstorm canvas",
        group: "Create",
        icon: Lightbulb,
        run: () =>
          createAndToast(
            router,
            "/api/boards",
            { title: "Untitled Board", scope: "brainstorm" },
            (d) => d.board?.id,
            "/brainstorm-sketch",
            "Brainstorm board created"
          ),
      },
      { id: "create-note", label: "New Note", hint: "open editor", group: "Create", icon: NotebookPen, run: () => router.push("/notepad?new=1") },
      { id: "create-lead", label: "New Lead", hint: "open form", group: "Create", icon: Users, run: () => router.push("/leads?new=1") },
      { id: "create-link", label: "New Link", hint: "open form", group: "Create", icon: Link2, run: () => router.push("/useful-links?new=1") },
      { id: "create-chat", label: "New Chat", hint: "start conversation", group: "Create", icon: MessageSquare, run: () => router.push("/chat") },
      { id: "create-upload", label: "Upload Document", hint: "open upload dialog", group: "Create", icon: FileText, run: () => router.push("/documents?upload=1") },
      { id: "create-todoist", label: "New Todoist Task", hint: "open form", group: "Create", icon: Workflow, run: () => router.push("/todoist?new=1") },
    ],
    [router]
  );

  const actionEntries = useMemo<CmdEntry[]>(
    () => [
      {
        id: "act-open-terminal",
        label: "Open terminal",
        hint: "/terminal",
        group: "Actions",
        icon: Terminal,
        run: () => router.push("/terminal"),
      },
      {
        id: "act-start-agent",
        label: "Start agent",
        hint: "/agents",
        group: "Actions",
        icon: Bot,
        run: () => router.push("/agents"),
      },
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
        hint: r.subtitle ? `${r.label} ${r.subtitle}` : r.label,
        group: "Results" as const,
        icon: SECTION_ICONS[r.type] ?? Search,
        run: () => router.push(r.href),
      })),
    [results, router]
  );

  const recentEntries = useMemo<CmdEntry[]>(
    () =>
      recent.map((a) => ({
        id: `recent-${a.id}`,
        label: a.title,
        hint: "recent",
        group: "Recent" as const,
        icon: RECENT_CATEGORY_ICON[a.category] ?? Activity,
        run: () => router.push(RECENT_CATEGORY_ROUTE[a.category] ?? "/activity"),
      })),
    [recent, router]
  );

  const q = query.trim().toLowerCase();
  const matches = (e: CmdEntry) =>
    !q ||
    e.label.toLowerCase().includes(q) ||
    e.hint?.toLowerCase().includes(q) ||
    e.group.toLowerCase().includes(q);

  const nav = navEntries.filter(matches);
  const create = createEntries.filter(matches);
  const actions = actionEntries.filter(matches);
  const recentShown = !q ? recentEntries : [];

  const hasStatic = nav.length > 0 || create.length > 0 || actions.length > 0;
  const showEmpty = q.length >= 2 && !searching && results.length === 0 && !hasStatic;

  return (
    <>
      <CommandInput
        ref={inputRef}
        value={query}
        onValueChange={setQuery}
        placeholder="Search the workspace"
      />
      <CommandList>
        {showEmpty && (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            No results found.
          </div>
        )}

        {searching && q.length >= 2 && (
          <CommandGroup heading="Results">
            <CommandItem disabled value="__searching__">
              <Search className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">Searching</span>
            </CommandItem>
          </CommandGroup>
        )}

        {results.length > 0 && (
          <CommandGroup heading="Results">
            {searchEntries.map((entry) => (
              <CommandItem
                key={entry.id}
                value={entry.id}
                onSelect={entry.run}
              >
                <entry.icon
                  className={cn(
                    "size-4 shrink-0",
                    "text-muted-foreground"
                  )}
                />
                <span className="flex-1">{entry.label}</span>
                {entry.hint && (
                  <span className="text-xs text-muted-foreground">
                    {entry.hint}
                  </span>
                )}
                <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {recentShown.length > 0 && (
          <CommandGroup heading="Recent">
            {recentShown.map((entry) => (
              <CommandItem
                key={entry.id}
                value={entry.id}
                onSelect={entry.run}
              >
                <entry.icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1">{entry.label}</span>
                <span className="text-xs text-muted-foreground">
                  {entry.hint}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {create.length > 0 && (
          <CommandGroup heading="Create">
            {create.map((entry) => (
              <CommandItem
                key={entry.id}
                value={entry.id}
                onSelect={entry.run}
              >
                <entry.icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1">{entry.label}</span>
                {entry.hint && (
                  <span className="text-xs text-muted-foreground">
                    {entry.hint}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {nav.length > 0 && (
          <CommandGroup heading="Navigate">
            {nav.map((entry) => (
              <CommandItem
                key={entry.id}
                value={entry.id}
                onSelect={entry.run}
              >
                <entry.icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1">{entry.label}</span>
                {entry.hint && (
                  <CommandShortcut>{entry.hint}</CommandShortcut>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {actions.length > 0 && (
          <CommandGroup heading="Actions">
            {actions.map((entry) => (
              <CommandItem
                key={entry.id}
                value={entry.id}
                onSelect={entry.run}
              >
                <entry.icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1">{entry.label}</span>
                {entry.hint && (
                  <span className="text-xs text-muted-foreground">
                    {entry.hint}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>

      <div className="flex items-center justify-between border-t border-border px-3 py-2 font-label text-xs text-muted-foreground">
        <span className="flex items-center gap-3">
          <span>Enter to open</span>
          <span>Esc to close</span>
        </span>
        <span className="flex items-center gap-2">
          <Sparkles className="size-3 text-flame" />
          <span>Command palette</span>
        </span>
      </div>
    </>
  );
}
