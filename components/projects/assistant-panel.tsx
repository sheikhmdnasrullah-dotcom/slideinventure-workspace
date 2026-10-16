"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import * as React from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { FilePlus2, Loader2, Pin, Send, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProjectWorkspace, TreeNode } from "./use-project";

type Props = {
  projectId: string;
  workspace: ProjectWorkspace;
  onReviewProposal: () => void;
};

function flattenFiles(nodes: TreeNode[], out: { path: string }[] = []): { path: string }[] {
  for (const n of nodes) {
    if (n.type === "file") out.push({ path: n.path });
    else if (n.children) flattenFiles(n.children, out);
  }
  return out;
}

type LoosePart = {
  type: string;
  text?: string;
  toolName?: string;
  state?: string;
};

function friendlyToolStatus(part: LoosePart): string | null {
  if (!part.type.startsWith("tool-") && part.type !== "dynamic-tool") return null;
  const name = part.toolName ?? part.type.replace(/^tool-/, "");
  const done = part.state === "output-available" || part.state === "done";
  const verb =
    name === "read_file"
      ? done
        ? "Read a file"
        : "Reading a file…"
      : name === "list_files"
        ? done
          ? "Listed files"
          : "Listing files…"
        : name === "search_files"
          ? done
            ? "Searched the project"
            : "Searching the project…"
          : name === "propose_edit" || name === "propose_create"
            ? done
              ? "Prepared a proposal for review"
              : "Preparing a proposal…"
            : done
              ? "Working"
              : "Working…";
  return verb;
}

export function AssistantPanel({ projectId, workspace, onReviewProposal }: Props) {
  const [input, setInput] = React.useState("");
  const [pinned, setPinned] = React.useState<string[]>([]);
  const [sawProposal, setSawProposal] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);
  const openFile = workspace.activePath;

  // useChat reads the latest transport on every send, so keying it on the
  // context values keeps the sent context fresh without render-time ref writes.
  const transport = React.useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/projects/${projectId}/assistant`,
        body: { context: { openFile, pinned } },
      }),
    [projectId, openFile, pinned]
  );

  const { messages, sendMessage, status, error, stop } = useChat({ transport });
  const streaming = status === "streaming" || status === "submitted";

  // New proposals may arrive during a run — refresh the pending count when the
  // run settles, and nudge the user to review.
  const prevStatus = React.useRef(status);
  React.useEffect(() => {
    if (prevStatus.current !== "ready" && status === "ready") {
      workspace.refreshProposals();
    }
    prevStatus.current = status;
  }, [status, workspace]);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  React.useEffect(() => {
    const pending = workspace.proposals.filter((p) => p.status === "pending");
    setSawProposal(pending.length > 0);
  }, [workspace.proposals]);

  const allFiles = React.useMemo(() => flattenFiles(workspace.tree), [workspace.tree]);
  const pendingCount = workspace.proposals.filter((p) => p.status === "pending").length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || streaming) return;
    sendMessage({ text });
    setInput("");
  }

  function pinCurrent() {
    const path = workspace.activePath;
    if (path && !pinned.includes(path)) setPinned((p) => [...p, path]);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-3">
        <p className="text-sm font-semibold">Project assistant</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Ask about your files in plain language. Changes are always proposed first — nothing is saved without your approval.
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {workspace.activePath && (
            <Badge variant="secondary" className="gap-1 text-xs">
              Open: {workspace.activePath}
            </Badge>
          )}
          {pinned.filter((p) => p !== workspace.activePath).map((p) => (
            <Badge key={p} variant="outline" className="gap-1 text-xs">
              <Pin className="h-3 w-3" />
              {p}
              <button
                type="button"
                onClick={() => setPinned((list) => list.filter((x) => x !== p))}
                aria-label={`Remove ${p} from context`}
                className="ml-1 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>

        <div className="mt-2 flex gap-1.5">
          <Select
            value=""
            onValueChange={(v) => {
              if (v && !pinned.includes(v)) setPinned((p) => [...p, v]);
            }}
          >
            <SelectTrigger className="h-8 flex-1 text-xs" aria-label="Add a file to the context">
              <SelectValue placeholder="Add a file to the context…" />
            </SelectTrigger>
            <SelectContent>
              {allFiles.length === 0 ? (
                <SelectItem value="__none" disabled>No files in this project yet</SelectItem>
              ) : (
                allFiles
                  .filter((f) => f.path !== workspace.activePath && !pinned.includes(f.path))
                  .map((f) => (
                    <SelectItem key={f.path} value={f.path} className="text-xs">
                      {f.path}
                    </SelectItem>
                  ))
              )}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={pinCurrent}
            disabled={!workspace.activePath || pinned.includes(workspace.activePath ?? "")}
            title="Keep the open file in context while you browse other files"
          >
            <Pin className="mr-1 h-3.5 w-3.5" /> Pin open file
          </Button>
        </div>

        {pendingCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            className="mt-2 w-full text-xs"
            onClick={onReviewProposal}
          >
            <FilePlus2 className="mr-1.5 h-3.5 w-3.5" />
            Review {pendingCount} proposed change{pendingCount === 1 ? "" : "s"}
          </Button>
        )}
        {sawProposal && pendingCount === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">All proposals decided.</p>
        )}
      </div>

      <ScrollArea className="flex-1 p-3">
        {messages.length === 0 && (
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>Try asking:</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>“What&apos;s in this project?”</li>
              <li>“Read my open file and tell me what is missing.”</li>
              <li>“Compare the strategy doc with the project brief.”</li>
              <li>“Draft an implementation checklist from these documents.”</li>
            </ul>
          </div>
        )}
        <div className="space-y-3">
          {messages.map((m) => (
            <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[92%] rounded-lg px-3 py-2 text-[13px] leading-relaxed",
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                )}
              >
                {(m.parts as LoosePart[]).map((p, i) => {
                  if (p.type === "text") {
                    return (
                      <p key={i} className="whitespace-pre-wrap">
                        {p.text}
                      </p>
                    );
                  }
                  const toolStatus = friendlyToolStatus(p);
                  if (toolStatus) {
                    const active = toolStatus.endsWith("…");
                    return (
                      <span
                        key={i}
                        className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"
                      >
                        {active && <Loader2 className="h-3 w-3 animate-spin" />}
                        {toolStatus}
                      </span>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          ))}
          {streaming && messages[messages.length - 1]?.role === "user" && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
            </p>
          )}
        </div>
        <div ref={endRef} />
      </ScrollArea>

      {error && (
        <p className="border-t bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
          {error.message.includes("No AI provider")
            ? "No AI provider is configured, so the assistant can't answer yet. Files, editing, and version history still work."
            : `The assistant ran into a problem: ${error.message}`}
        </p>
      )}

      <form onSubmit={submit} className="flex gap-2 border-t p-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your project…"
          rows={2}
          className="resize-none text-[13px]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(e);
            }
          }}
          aria-label="Ask the project assistant"
        />
        {streaming ? (
          <Button type="button" variant="outline" size="icon" onClick={() => stop()} title="Stop">
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="submit" size="icon" disabled={!input.trim()} title="Send">
            <Send className="h-4 w-4" />
          </Button>
        )}
      </form>
    </div>
  );
}
