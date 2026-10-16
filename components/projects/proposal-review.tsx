"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import * as React from "react";
import { Check, Plus, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { diffLines, summarizeDiff } from "@/lib/project-workspace/diff";
import type { ProjectWorkspace, Proposal } from "./use-project";
import { projectApi, ProjectApiError } from "./use-project";

type Props = {
  projectId: string;
  proposal: Proposal | null;
  workspace: ProjectWorkspace;
  onClose: () => void;
};

const CONTEXT_LINES = 3;

export function ProposalReview({ projectId, proposal, workspace, onClose }: Props) {
  const [baseContent, setBaseContent] = React.useState<string | null>(null);
  const [baseError, setBaseError] = React.useState<string | null>(null);
  const [deciding, setDeciding] = React.useState(false);
  const [decisionError, setDecisionError] = React.useState<string | null>(null);
  const [fullView, setFullView] = React.useState(false);

  React.useEffect(() => {
    setBaseContent(null);
    setBaseError(null);
    setDecisionError(null);
    setFullView(false);
    if (!proposal || proposal.op === "create") return;
    projectApi
      .read(projectId, proposal.path)
      .then(({ file }) => setBaseContent(file.content))
      .catch((e) =>
        setBaseError(
          e instanceof ProjectApiError && e.status === 404
            ? "The original file no longer exists, so this proposal can't be applied."
            : `Couldn't load the current file: ${e instanceof Error ? e.message : "unknown error"}`
        )
      );
  }, [projectId, proposal]);

  const ops = React.useMemo(() => {
    if (!proposal) return [];
    if (proposal.op === "create") return diffLines("", proposal.content);
    if (baseContent === null) return [];
    return diffLines(baseContent, proposal.content);
  }, [proposal, baseContent]);

  const summary = React.useMemo(() => summarizeDiff(ops), [ops]);

  // Collapse long unchanged runs unless the user wants the full view.
  const visibleOps = React.useMemo(() => {
    if (fullView) return ops.map((op, i) => ({ op, i, collapsed: 0 }));
    const changedIdx = new Set<number>();
    ops.forEach((op, i) => {
      if (op.type !== "same") {
        for (let k = Math.max(0, i - CONTEXT_LINES); k <= Math.min(ops.length - 1, i + CONTEXT_LINES); k++) {
          changedIdx.add(k);
        }
      }
    });
    const rows: { op: (typeof ops)[number]; i: number; collapsed: number }[] = [];
    let i = 0;
    while (i < ops.length) {
      if (changedIdx.has(i)) {
        rows.push({ op: ops[i]!, i, collapsed: 0 });
        i++;
      } else {
        let j = i;
        while (j < ops.length && !changedIdx.has(j)) j++;
        rows.push({ op: ops[i]!, i, collapsed: j - i });
        i = j;
      }
    }
    return rows;
  }, [ops, fullView]);

  async function decide(action: "accept" | "reject") {
    if (!proposal || deciding) return;
    setDeciding(true);
    setDecisionError(null);
    try {
      const result = await projectApi.decideProposal(projectId, proposal.id, action);
      if (result.file) {
        // Refresh the open tab if it's showing this file.
        workspace.replaceTabFile(result.file);
        workspace.openFile(result.file.path);
      }
      workspace.refreshTree();
      workspace.refreshProposals();
      onClose();
    } catch (e) {
      setDecisionError(
        e instanceof ProjectApiError && e.isConflict
          ? "The file changed since this proposal was made, so it can't be applied safely. Ask for a fresh proposal from the current version."
          : `Couldn't ${action} the proposal: ${e instanceof Error ? e.message : "unknown error"}`
      );
    } finally {
      setDeciding(false);
    }
  }

  const decided = proposal?.status === "accepted" || proposal?.status === "rejected";
  const stale = proposal?.status === "stale";

  return (
    <Dialog open={!!proposal} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {proposal?.op === "create" ? (
              <Plus className="h-4 w-4" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {proposal?.op === "create" ? "New file" : "Proposed change"}: {proposal?.path}
          </DialogTitle>
          <DialogDescription>{proposal?.summary}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Badge variant={proposal?.op === "create" ? "default" : "secondary"}>
            {proposal?.op === "create" ? "Create" : "Edit"}
          </Badge>
          {proposal?.status === "pending" ? (
            <Badge variant="outline">Awaiting your review — nothing saved yet</Badge>
          ) : (
            <Badge variant="outline" className="capitalize">{proposal?.status}</Badge>
          )}
          {ops.length > 0 && (
            <span className="ml-auto text-xs text-muted-foreground">
              <span className="font-medium text-status-live">+{summary.added}</span> /{" "}
              <span className="font-medium text-status-danger">−{summary.removed}</span> lines
            </span>
          )}
        </div>

        {baseError ? (
          <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{baseError}</p>
        ) : proposal?.op === "edit" && baseContent === null ? (
          <p className="p-3 text-sm text-muted-foreground">Loading the current file…</p>
        ) : (
          <>
            <ScrollArea className="max-h-[45vh] rounded-md border">
              <div className="min-w-[560px] font-code text-[12px] leading-relaxed">
                {visibleOps.map(({ op, i, collapsed }) =>
                  collapsed > 0 ? (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setFullView(true)}
                      className="block w-full bg-surface-2 px-3 py-0.5 text-left text-xs text-ink-muted hover:bg-hover-tint hover:text-ink-strong"
                    >
                      … {collapsed} unchanged lines (show all)
                    </button>
                  ) : (
                    <div
                      key={i}
                      className={cn(
                        "flex gap-3 whitespace-pre-wrap break-all px-3 py-0.5",
                        op.type === "add" && "bg-status-live-bg text-ink-strong",
                        op.type === "remove" && "bg-status-danger-bg text-ink-strong"
                      )}
                    >
                      <span className="w-8 shrink-0 select-none text-right text-muted-foreground">
                        {op.type === "add" ? `+${op.newLine}` : op.type === "remove" ? `−${op.oldLine}` : op.newLine}
                      </span>
                      <span className="w-3 shrink-0 select-none text-muted-foreground">
                        {op.type === "add" ? "+" : op.type === "remove" ? "−" : " "}
                      </span>
                      <span>{op.text || " "}</span>
                    </div>
                  )
                )}
              </div>
            </ScrollArea>
            {!fullView && (
              <Button variant="link" size="sm" className="h-auto self-start p-0" onClick={() => setFullView(true)}>
                Show the full file
              </Button>
            )}
          </>
        )}

        {decisionError && (
          <p className="rounded-md bg-red-50 p-2 text-sm text-red-800" role="alert">
            {decisionError}
          </p>
        )}

        <DialogFooter>
          {decided || stale ? (
            <Button variant="outline" onClick={onClose}>Close</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => decide("reject")} disabled={deciding}>
                <X className="mr-1.5 h-4 w-4" /> Reject
              </Button>
              <Button onClick={() => decide("accept")} disabled={deciding || !!baseError}>
                <Check className="mr-1.5 h-4 w-4" />
                {deciding ? "Applying…" : proposal?.op === "create" ? "Create file" : "Apply change"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
