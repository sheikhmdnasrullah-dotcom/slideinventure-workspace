"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FilePlus2,
  FolderPlus,
  MoreVertical,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileTree } from "./file-tree";
import { FileView } from "./file-view";
import { AssistantPanel } from "./assistant-panel";
import { ProposalReview } from "./proposal-review";
import { VersionHistory } from "./version-history";
import { projectApi, useProjectWorkspace, type Proposal } from "./use-project";
import { SectionErrorBoundary } from "@/components/system/error-boundary";

type Props = { projectId: string };

type CreateDialog = { type: "file" | "folder"; folder: string } | null;

function ProposalsSheet({
  proposals,
  onReview,
}: {
  proposals: Proposal[];
  onReview: (p: Proposal) => void;
}) {
  const pending = proposals.filter((p) => p.status === "pending" || p.status === "stale");
  const decided = proposals.filter((p) => p.status === "accepted" || p.status === "rejected");
  if (proposals.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">No proposals yet. Ask the assistant to change or create a file, and its proposal will appear here for your review.</p>;
  }
  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 p-3">
        {pending.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onReview(p)}
            className="block w-full rounded-md border p-3 text-left hover:bg-muted"
          >
            <p className="text-sm font-medium">
              {p.op === "create" ? "New file" : "Change"}: {p.path}
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{p.summary}</p>
            <p className="mt-1 text-xs text-status-warn">
              {p.status === "stale" ? "Stale — the file changed since" : "Awaiting review"}
            </p>
          </button>
        ))}
        {decided.length > 0 && (
          <>
            <p className="px-1 pt-2 text-xs font-medium text-muted-foreground">Decided</p>
            {decided.slice(0, 10).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onReview(p)}
                className="block w-full rounded-md border border-dashed border-rule-strong p-2 text-left text-xs text-muted-foreground hover:bg-hover-tint"
              >
                <span className="capitalize">{p.status}</span>: {p.op} {p.path}
              </button>
            ))}
          </>
        )}
      </div>
    </ScrollArea>
  );
}

function WorkspaceInner({ projectId }: Props) {
  const workspace = useProjectWorkspace(projectId);
  const [leftOpen, setLeftOpen] = React.useState(true);
  const [rightOpen, setRightOpen] = React.useState(true);
  const [rightTab, setRightTab] = React.useState<"assistant" | "proposals">("assistant");
  const [createDialog, setCreateDialog] = React.useState<CreateDialog>(null);
  const [createName, setCreateName] = React.useState("");
  const [renameTarget, setRenameTarget] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [reviewing, setReviewing] = React.useState<Proposal | null>(null);
  const [historyPath, setHistoryPath] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const fileInput = React.useRef<HTMLInputElement>(null);

  const dirtyPaths = React.useMemo(
    () => new Set(workspace.tabs.filter((t) => t.draft !== undefined).map((t) => t.path)),
    [workspace.tabs]
  );

  const pendingCount = workspace.proposals.filter((p) => p.status === "pending").length;

  async function handleCreate() {
    if (!createDialog || !createName.trim()) return;
    setBusy(true);
    try {
      const base = createDialog.folder ? `${createDialog.folder}/` : "";
      const path = `${base}${createName.trim()}`;
      if (createDialog.type === "folder") {
        await projectApi.createFolder(projectId, path);
        toast.success(`Folder "${path}" created`);
      } else {
        const { file } = await projectApi.createFile(projectId, path, "");
        toast.success(`File "${path}" created`);
        workspace.openFile(file.path);
      }
      setCreateDialog(null);
      setCreateName("");
      workspace.refreshTree();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create");
    } finally {
      setBusy(false);
    }
  }

  async function handleRename() {
    if (!renameTarget) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      toast.error("Enter a name");
      return;
    }
    setBusy(true);
    try {
      const { path } = await projectApi.move(projectId, renameTarget, "", trimmed);
      toast.success(`Renamed to "${path}"`);
      setRenameTarget(null);
      workspace.refreshTree();
      // Re-point an open tab at the new path.
      const tab = workspace.tabs.find((t) => t.path === renameTarget);
      if (tab) {
        workspace.closeTab(renameTarget);
        workspace.openFile(path);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't rename");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await projectApi.removeFile(projectId, deleteTarget);
      toast.success("Deleted");
      setDeleteTarget(null);
      workspace.closeTab(deleteTarget);
      workspace.refreshTree();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await projectApi.upload(projectId, file, "");
        toast.success(`Uploaded "${file.name}"`);
      }
      workspace.refreshTree();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function reviewProposal(p: Proposal) {
    setRightTab("proposals");
    setReviewing(p);
  }

  if (workspace.treeLoading) {
    return <p className="p-8 text-sm text-muted-foreground">Opening project…</p>;
  }
  if (workspace.treeError || !workspace.project) {
    return (
      <div className="p-8 text-sm">
        <p className="font-medium">Could not open this project</p>
        <p className="mt-1 text-muted-foreground">{workspace.treeError ?? "Project not found"}</p>
        <Button variant="outline" size="sm" className="mt-3" render={<Link href="/projects" />}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to projects
        </Button>
      </div>
    );
  }

  const activeTab = workspace.activeTab;
  const activeName = activeTab ? activeTab.path.split("/").pop() : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          render={<Link href="/projects" />}
          title="Back to projects"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{workspace.project.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {activeName ? `Viewing ${activeTab!.path}` : "Select a file to inspect it"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLeftOpen((v) => !v)} title={leftOpen ? "Hide files" : "Show files"}>
            {leftOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRightOpen((v) => !v)} title={rightOpen ? "Hide assistant" : "Show assistant"}>
            {rightOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <FilePlus2 className="mr-1.5 h-4 w-4" /> New
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setCreateDialog({ type: "file", folder: "" })}>
                <FilePlus2 className="mr-2 h-4 w-4" /> New file
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCreateDialog({ type: "folder", folder: "" })}>
                <FolderPlus className="mr-2 h-4 w-4" /> New folder
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => fileInput.current?.click()}>
                <Upload className="mr-2 h-4 w-4" /> Upload files
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            ref={fileInput}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>
      </div>

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        {leftOpen && (
          <>
            <ResizablePanel defaultSize="22" minSize="15" maxSize="35">
              <div className="flex h-full flex-col border-r">
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <p className="font-label text-ink-muted">
                    Project files
                  </p>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="ghost" size="icon" className="h-7 w-7" aria-label="File actions" />}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        disabled={!activeTab}
                        onClick={() => {
                          if (activeTab) {
                            setRenameTarget(activeTab.path);
                            setRenameValue(activeTab.path.split("/").pop() ?? "");
                          }
                        }}
                      >
                        <Pencil className="mr-2 h-4 w-4" /> Rename open file
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!activeTab}
                        onClick={() => activeTab && setDeleteTarget(activeTab.path)}
                        className="text-status-danger"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete open file
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="min-h-0 flex-1">
                  <FileTree
                    tree={workspace.tree}
                    activePath={workspace.activePath}
                    dirtyPaths={dirtyPaths}
                    onOpen={(path) => workspace.openFile(path)}
                    onSearch={async (q) => (await projectApi.search(projectId, q)).hits}
                  />
                </div>
                {uploading && (
                  <p className="border-t px-3 py-2 text-xs text-muted-foreground">Uploading…</p>
                )}
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
          </>
        )}

        <ResizablePanel defaultSize={rightOpen ? "48" : "78"} minSize="30">
          <div className="flex h-full flex-col">
            {workspace.tabs.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto border-b px-2 py-1.5">
                {workspace.tabs.map((t) => {
                  const name = t.path.split("/").pop() ?? t.path;
                  const dirty = t.draft !== undefined;
                  const active = t.path === workspace.activePath;
                  return (
                    <button
                      key={t.path}
                      type="button"
                      onClick={() => workspace.setActive(t.path)}
                      title={t.path}
                      className={cn(
                        "group flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs hover:bg-muted",
                        active ? "bg-muted font-medium" : "text-muted-foreground"
                      )}
                    >
                      {dirty && <span className="h-1.5 w-1.5 rounded-full bg-status-warn" />}
                      {name}
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={`Close ${name}`}
                        className="rounded-md p-0.5 hover:bg-hover-tint"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (dirty && !window.confirm("Discard unsaved changes?")) return;
                          workspace.closeTab(t.path);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.stopPropagation();
                            workspace.closeTab(t.path);
                          }
                        }}
                      >
                        <X className="h-3 w-3" />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="min-h-0 flex-1">
              {activeTab ? (
                <FileView
                  projectId={projectId}
                  tab={activeTab}
                  workspace={workspace}
                  onShowHistory={(path) => setHistoryPath(path)}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
                  <p className="text-sm font-medium">No file open</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Pick a file on the left to inspect its contents, or create one to start building this project&apos;s working files.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" onClick={() => setCreateDialog({ type: "file", folder: "" })}>
                      <FilePlus2 className="mr-1.5 h-4 w-4" /> New file
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
                      <Upload className="mr-1.5 h-4 w-4" /> Upload
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>

        {rightOpen && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="30" minSize="20" maxSize="45">
              <div className="flex h-full flex-col border-l">
                <div className="flex gap-1 border-b p-1.5">
                  <Button
                    variant={rightTab === "assistant" ? "secondary" : "ghost"}
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => setRightTab("assistant")}
                  >
                    Assistant
                  </Button>
                  <Button
                    variant={rightTab === "proposals" ? "secondary" : "ghost"}
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => {
                      setRightTab("proposals");
                      workspace.refreshProposals();
                    }}
                  >
                    Proposals{pendingCount > 0 ? ` (${pendingCount})` : ""}
                  </Button>
                </div>
                <div className="min-h-0 flex-1">
                  {rightTab === "assistant" ? (
                    <AssistantPanel
                      projectId={projectId}
                      workspace={workspace}
                      onReviewProposal={() => {
                        setRightTab("proposals");
                        workspace.refreshProposals();
                      }}
                    />
                  ) : (
                    <ProposalsSheet proposals={workspace.proposals} onReview={reviewProposal} />
                  )}
                </div>
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      <Dialog open={!!createDialog} onOpenChange={(open) => !open && setCreateDialog(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {createDialog?.type === "folder" ? "New folder" : "New file"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="new-name">
              {createDialog?.type === "folder" ? "Folder name" : "File name (use .md for documents, .sql for queries)"}
            </Label>
            <Input
              id="new-name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder={createDialog?.type === "folder" ? "docs" : "brief.md"}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(null)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={busy || !createName.trim()}>
              {busy ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Rename</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="rename-value">New name</Label>
            <Input
              id="rename-value"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button onClick={handleRename} disabled={busy}>
              {busy ? "Renaming…" : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget}?</DialogTitle>
          </DialogHeader>
          <p className="py-2 text-sm text-muted-foreground">
            This removes the file from the project. Folders must be empty before they can be deleted.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={busy}>
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProposalReview
        projectId={projectId}
        proposal={reviewing}
        workspace={workspace}
        onClose={() => setReviewing(null)}
      />
      <VersionHistory
        projectId={projectId}
        path={historyPath}
        workspace={workspace}
        onClose={() => setHistoryPath(null)}
      />
    </div>
  );
}

export function ProjectWorkspaceView({ projectId }: Props) {
  return (
    <SectionErrorBoundary label="Project workspace">
      <WorkspaceInner projectId={projectId} />
    </SectionErrorBoundary>
  );
}
