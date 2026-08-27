"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCopilotAction } from "@copilotkit/react-core";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sectionForPathname, routeForSection } from "@/lib/copilot/section-context";

type SearchResult = {
  id: string;
  type: string;
  label: string;
  title: string;
  subtitle?: string;
  href: string;
};

/**
 * Registers the copilot's real capabilities. Every action hits an existing
 * authenticated endpoint and reports a true result string back to the model,
 * with a toast for the user. Side-effecting, paid actions (runAgent) require
 * human approval through renderAndWaitForResponse; harmless reads do not.
 */
export function CopilotActions() {
  const pathname = usePathname();
  const router = useRouter();

  useCopilotAction({
    name: "navigateTo",
    description:
      "Navigate the dashboard to a section. Use when the user asks to go to, open, or show a specific area such as AI Venture, Research Lab, Notes, Leads, or Terminal.",
    parameters: [
      {
        name: "section",
        type: "string",
        description:
          "The section to open, by id or label, e.g. 'ai-venture', 'AI Venture', 'research-lab', 'notepad', 'leads'.",
        required: true,
      },
    ],
    handler: async ({ section }) => {
      const route = routeForSection(section);
      if (!route) {
        toast.error(`Unknown section: ${section}`);
        return `Could not find a section named "${section}".`;
      }
      router.push(route);
      toast.success(`Navigating to ${section}`);
      return `Navigated to ${section} (${route}).`;
    },
  });

  useCopilotAction({
    name: "searchWorkspace",
    description:
      "Search the workspace for notes, documents, leads, concepts, research, links, and more. Use when the user asks to find, look up, or search for something. When the user says 'here' or 'this section', scope the search to the current section.",
    parameters: [
      { name: "query", type: "string", description: "The search query.", required: true },
      {
        name: "scope",
        type: "string",
        description:
          "Optional. 'section' limits to the current section, 'global' searches everything. Defaults to the current section's scope.",
        required: false,
      },
    ],
    handler: async ({ query, scope }) => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({ results: [] }))) as {
        results?: SearchResult[];
      };
      if (!res.ok) {
        toast.error("Search failed");
        return "Search request failed.";
      }
      const results = Array.isArray(data.results) ? data.results : [];
      const current = sectionForPathname(pathname);
      const effectiveScope =
        scope === "global" || scope === "section" ? scope : current.searchScope;
      const filtered =
        effectiveScope === "section"
          ? results.filter((r) => current.sources.includes(r.type))
          : results;

      if (filtered.length === 0) {
        return `No results found for "${query}"${
          effectiveScope === "section" ? ` in ${current.label}` : ""
        }.`;
      }
      toast.success(`Found ${filtered.length} result${filtered.length === 1 ? "" : "s"}`);
      return JSON.stringify({
        scope: effectiveScope,
        count: filtered.length,
        results: filtered.slice(0, 15).map((r) => ({
          title: r.title,
          type: r.type,
          href: r.href,
        })),
      });
    },
  });

  useCopilotAction({
    name: "createNote",
    description:
      "Create a new note. Use when the user asks to save, jot down, or create a note. The note is scoped to the current section automatically.",
    parameters: [
      { name: "title", type: "string", description: "Note title.", required: true },
      {
        name: "content",
        type: "string",
        description: "Note body text. Plain text is fine.",
        required: false,
      },
    ],
    handler: async ({ title, content }) => {
      const current = sectionForPathname(pathname);
      const scope =
        current.id === "ai-venture"
          ? "ai-venture"
          : current.id === "brainstorm-sketch"
            ? "brainstorm"
            : "global";
      const res = await fetch("/api/notes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content: content ?? "", scope }),
      });
      const data = (await res.json().catch(() => ({}))) as { note?: { id?: string }; error?: string };
      if (!res.ok) {
        toast.error("Could not create note");
        return `Failed to create note: ${data.error ?? res.status}`;
      }
      toast.success("Note created");
      return `Created note "${title}" (id: ${data.note?.id ?? "unknown"}, scope: ${scope}).`;
    },
  });

  useCopilotAction({
    name: "createIdeaMap",
    description:
      "Create a new idea map (mind map board). Use when the user asks to start or create an idea map or mind map.",
    parameters: [
      { name: "title", type: "string", description: "Idea map title.", required: true },
    ],
    handler: async ({ title }) => {
      const res = await fetch("/api/idea-maps", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = (await res.json().catch(() => ({}))) as { map?: { id?: string }; error?: string };
      if (!res.ok) {
        toast.error("Could not create idea map");
        return `Failed to create idea map: ${data.error ?? res.status}`;
      }
      toast.success("Idea map created");
      return `Created idea map "${title}" (id: ${data.map?.id ?? "unknown"}).`;
    },
  });

  useCopilotAction({
    name: "createTerminalCommand",
    description:
      "Save a shell command to the workspace command library. Use when the user asks to save or store a terminal command.",
    parameters: [
      { name: "command", type: "string", description: "The shell command.", required: true },
      { name: "title", type: "string", description: "Short title for the command.", required: true },
      {
        name: "description",
        type: "string",
        description: "What the command does.",
        required: false,
      },
      {
        name: "category",
        type: "string",
        description: "Optional category, e.g. 'git', 'deploy', 'docker'.",
        required: false,
      },
    ],
    handler: async ({ command, title, description, category }) => {
      const res = await fetch("/api/terminal", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command,
          title,
          description: description ?? null,
          category: category ?? null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok) {
        toast.error("Could not save command");
        return `Failed to save command: ${data.error ?? res.status}`;
      }
      toast.success("Command saved");
      return `Saved terminal command "${title}" (id: ${data.id ?? "unknown"}).`;
    },
  });

  useCopilotAction({
    name: "runAgent",
    description:
      "Run an installed agent persona against a message. This makes a real LLM call and may cost money, so it requires your approval before it runs. Provide the agent slug and the message.",
    parameters: [
      {
        name: "slug",
        type: "string",
        description:
          "Agent slug, e.g. 'research-assistant', 'outreach-agent', 'email-crawler'.",
        required: true,
      },
      {
        name: "message",
        type: "string",
        description: "The instruction or question for the agent.",
        required: true,
      },
    ],
    renderAndWaitForResponse: ({ args, status, respond }) => {
      const [busy, setBusy] = React.useState(false);

      async function approve() {
        if (typeof respond !== "function") return;
        setBusy(true);
        try {
          const res = await fetch("/api/agents/chat", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug: args.slug, message: args.message }),
          });
          const data = (await res.json().catch(() => ({}))) as {
            answer?: string;
            agent?: string;
            error?: string;
          };
          if (!res.ok) {
            const msg = data.error ?? `Request failed (${res.status})`;
            toast.error(msg);
            respond(`Failed: ${msg}`);
            return;
          }
          const agentName = data.agent ?? args.slug;
          toast.success(`${agentName} responded`);
          respond(data.answer ?? "No answer returned.");
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Network error";
          toast.error(msg);
          respond(`Failed: ${msg}`);
        } finally {
          setBusy(false);
        }
      }

      function cancel() {
        if (typeof respond !== "function") return;
        respond("Cancelled by user.");
      }

      const canRespond = typeof respond === "function";

      return (
        <div className="w-72 rounded-lg border bg-card p-3 text-sm shadow-xl">
          <p className="font-medium text-foreground">Run agent</p>
          <p className="mt-1 text-muted-foreground">
            <span className="text-foreground">{args.slug}</span> will run with this message:
          </p>
          <p className="mt-1 line-clamp-3 rounded bg-muted px-2 py-1 text-xs text-foreground">
            {args.message}
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={approve} disabled={busy || !canRespond}>
              {busy ? "Running..." : "Approve"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={cancel}
              disabled={busy || !canRespond}
            >
              Cancel
            </Button>
          </div>
          {status === "inProgress" && (
            <p className="mt-2 text-xs text-muted-foreground">Waiting for arguments...</p>
          )}
        </div>
      );
    },
  });

  return null;
}
