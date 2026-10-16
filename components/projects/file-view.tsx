"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Download, ExternalLink, FileWarning, History, RefreshCw, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { OpenTab, ProjectWorkspace } from "./use-project";
import { projectApi } from "./use-project";

type Props = {
  projectId: string;
  tab: OpenTab;
  workspace: ProjectWorkspace;
  onShowHistory: (path: string) => void;
};

const markdownComponents = {
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="text-xl font-semibold" {...props} />
  ),
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="text-lg font-semibold" {...props} />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="text-base font-semibold" {...props} />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => <p {...props} />,
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="list-disc space-y-1 pl-5" {...props} />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="list-decimal space-y-1 pl-5" {...props} />
  ),
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a className="text-primary underline" {...props} />
  ),
  code: (props: React.HTMLAttributes<HTMLElement>) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]" {...props} />
  ),
  pre: (props: React.HTMLAttributes<HTMLPreElement>) => (
    <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-[12px]" {...props} />
  ),
  table: (props: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]" {...props} />
    </div>
  ),
  th: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
    <th className="border bg-muted px-2 py-1 text-left font-medium" {...props} />
  ),
  td: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
    <td className="border px-2 py-1" {...props} />
  ),
  blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote className="border-l-2 border-muted-foreground/30 pl-3 text-muted-foreground" {...props} />
  ),
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Plain-language description of what the workspace can do with this file. */
function capabilityNote(tab: OpenTab): string | null {
  const file = tab.file;
  if (!file) return null;
  if (file.editable) return null;
  switch (file.kind) {
    case "document":
      return file.content
        ? "Preview shows text extracted from this document. Formatting may differ from the original. To change it, edit the original elsewhere and upload a new copy."
        : "The workspace couldn't extract readable text from this document. You can still download it below.";
    case "image":
      return "Image preview. The AI can see this file's name but not its contents.";
    case "unknown":
      return "This file type isn't supported for preview or editing. It's stored safely and you can download it anytime.";
    default:
      return file.truncated
        ? "This file is too large to edit here. Showing the first part — download it to work with the full contents."
        : null;
  }
}

export function FileView({ projectId, tab, workspace, onShowHistory }: Props) {
  const [mode, setMode] = React.useState<"edit" | "preview">("edit");
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = React.useState<string | null>(null);
  const file = tab.file;
  const dirty = tab.draft !== undefined;
  const text = tab.draft ?? file?.content ?? "";

  const canEdit = !!file?.editable;

  const handleSave = React.useCallback(async () => {
    if (!dirty || !file) return;
    setSaveState("saving");
    setSaveMessage(null);
    const result = await workspace.saveTab(tab.path);
    if (result.ok) {
      setSaveState("saved");
      setSaveMessage("Saved.");
    } else {
      setSaveState("error");
      setSaveMessage(result.message);
    }
  }, [dirty, file, tab.path, workspace]);

  // Ctrl/Cmd+S saves.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave]);

  React.useEffect(() => {
    setSaveState("idle");
    setSaveMessage(null);
  }, [tab.path]);

  if (tab.loading) {
    return <p className="p-8 text-sm text-muted-foreground">Opening {tab.path}…</p>;
  }
  if (tab.error || !file) {
    return (
      <div className="p-8 text-sm">
        <p className="font-medium">Could not open this file</p>
        <p className="mt-1 text-muted-foreground">{tab.error ?? "Unknown error"}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => workspace.reloadTab(tab.path)}>
          <RefreshCw className="mr-2 h-4 w-4" /> Try again
        </Button>
      </div>
    );
  }

  const note = capabilityNote(tab);
  const showPreviewToggle = canEdit && file.kind === "markdown";
  const showExtractedPreview = !canEdit && file.kind === "document" && !!file.content;
  const showImage = file.kind === "image";

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={file.path}>
            {file.name}
            {dirty && <span className="ml-2 text-xs font-normal text-amber-600">● Unsaved changes</span>}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {file.path} · {formatBytes(file.sizeBytes)} · Updated{" "}
            {new Date(file.updatedAt).toLocaleString()}
          </p>
        </div>
        {showPreviewToggle && (
          <Tabs value={mode} onValueChange={(v) => setMode(v as "edit" | "preview")}>
            <TabsList className="h-8">
              <TabsTrigger value="edit" className="text-xs">Edit</TabsTrigger>
              <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        <Button variant="ghost" size="sm" onClick={() => onShowHistory(tab.path)} title="Version history">
          <History className="mr-1.5 h-4 w-4" /> History
        </Button>
        {canEdit && (
          <Button size="sm" onClick={handleSave} disabled={!dirty || saveState === "saving"}>
            <Save className="mr-1.5 h-4 w-4" />
            {saveState === "saving" ? "Saving…" : "Save"}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          render={<a href={projectApi.downloadUrl(projectId, file.path, true)} />}
        >
          <Download className="mr-1.5 h-4 w-4" /> Download
        </Button>
      </div>

      {(note || saveMessage) && (
        <div
          className={cn(
            "border-b px-4 py-2 text-xs",
            saveState === "error" ? "bg-red-50 text-red-800" : "bg-muted/60 text-muted-foreground"
          )}
          role="status"
        >
          {saveState === "error" ? saveMessage : (saveMessage ?? note)}
          {saveState === "error" && file && (
            <Button
              variant="link"
              size="sm"
              className="ml-2 h-auto p-0 text-xs"
              onClick={() => workspace.reloadTab(tab.path)}
            >
              Reload latest version
            </Button>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1">
        {canEdit && (mode === "edit" || file.kind !== "markdown") ? (
          <textarea
            value={text}
            onChange={(e) => workspace.setDraft(tab.path, e.target.value)}
            spellCheck={file.kind === "markdown" || file.kind === "text"}
            className="h-full w-full resize-none bg-transparent p-4 font-mono text-[13px] leading-relaxed outline-none"
            aria-label={`Edit ${file.name}`}
          />
        ) : showImage ? (
          <ScrollArea className="h-full">
            <div className="flex items-start justify-center p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={projectApi.downloadUrl(projectId, file.path)}
                alt={file.name}
                className="max-w-full rounded-md border"
              />
            </div>
          </ScrollArea>
        ) : file.kind === "markdown" || showExtractedPreview ? (
          <ScrollArea className="h-full">
            <article className="max-w-none space-y-3 p-6 text-sm leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {text}
              </ReactMarkdown>
            </article>
          </ScrollArea>
        ) : file.kind === "unknown" || (!canEdit && !file.content) ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <FileWarning className="h-8 w-8 text-muted-foreground" />
            <p className="max-w-sm text-sm text-muted-foreground">
              {note ?? "No preview available for this file."}
            </p>
            <Button
              variant="outline"
              size="sm"
              render={<a href={projectApi.downloadUrl(projectId, file.path, true)} />}
            >
              <Download className="mr-1.5 h-4 w-4" /> Download {file.name}
            </Button>
            <Button
              variant="link"
              size="sm"
              render={
                <a href={projectApi.downloadUrl(projectId, file.path)} target="_blank" rel="noreferrer" />
              }
            >
              <ExternalLink className="mr-1.5 h-4 w-4" /> Open in a new tab
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <pre className="whitespace-pre-wrap p-4 font-mono text-[13px] leading-relaxed">{text}</pre>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
