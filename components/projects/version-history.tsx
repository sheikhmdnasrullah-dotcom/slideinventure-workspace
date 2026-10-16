"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import * as React from "react";
import { History, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FileVersion, ProjectWorkspace } from "./use-project";
import { projectApi, ProjectApiError } from "./use-project";

type Props = {
  projectId: string;
  path: string | null;
  workspace: ProjectWorkspace;
  onClose: () => void;
};

const SOURCE_LABEL: Record<FileVersion["source"], string> = {
  "user-edit": "You edited",
  "assistant-accepted": "Assistant change applied",
  restore: "Restored version",
  upload: "Uploaded",
};

export function VersionHistory({ projectId, path, workspace, onClose }: Props) {
  const [versions, setVersions] = React.useState<Omit<FileVersion, "content">[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [restoring, setRestoring] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<{ id: string; content: string } | null>(null);

  React.useEffect(() => {
    setPreview(null);
    setError(null);
    if (!path) return;
    setLoading(true);
    projectApi
      .versions(projectId, path)
      .then(({ versions }) => setVersions(versions))
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load history"))
      .finally(() => setLoading(false));
  }, [projectId, path]);

  async function showPreview(versionId: string) {
    if (!path) return;
    if (preview?.id === versionId) {
      setPreview(null);
      return;
    }
    try {
      const { version } = await projectApi.versionContent(projectId, path, versionId);
      setPreview({ id: versionId, content: version.content });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load version");
    }
  }

  async function restore(versionId: string) {
    if (!path || restoring) return;
    const tab = workspace.tabs.find((t) => t.path === path);
    const expectedHash = tab?.file?.hash;
    // If the file isn't open we read it first so the conflict guard still applies.
    let hash = expectedHash;
    if (!hash) {
      try {
        hash = (await projectApi.read(projectId, path)).file.hash;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't read the current file");
        return;
      }
    }
    setRestoring(versionId);
    setError(null);
    try {
      const { file } = await projectApi.restore(projectId, path, versionId, hash);
      workspace.replaceTabFile(file);
      workspace.openFile(file.path);
      workspace.refreshTree();
      const { versions } = await projectApi.versions(projectId, path);
      setVersions(versions);
      onClose();
    } catch (e) {
      setError(
        e instanceof ProjectApiError && e.isConflict
          ? "The file changed since you opened it. Reload it and try restoring again."
          : `Couldn't restore: ${e instanceof Error ? e.message : "unknown error"}`
      );
    } finally {
      setRestoring(null);
    }
  }

  return (
    <Sheet open={!!path} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> Version history
          </SheetTitle>
          <SheetDescription>
            {path}
            <br />
            Restoring saves the current version first, so you can always undo.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="mt-4 flex-1">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading history…</p>
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No earlier versions yet. Versions are saved automatically each time this file changes.
            </p>
          ) : (
            <div className="space-y-2 pr-2">
              {versions.map((v) => (
                <div key={v.id} className="rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{SOURCE_LABEL[v.source] ?? v.source}</Badge>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(v.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    by {v.createdBy} · {(v.sizeBytes / 1024).toFixed(1)} KB
                  </p>
                  {preview?.id === v.id && (
                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 font-mono text-[11px]">
                      {preview.content.slice(0, 2000)}
                      {preview.content.length > 2000 && "…"}
                    </pre>
                  )}
                  <div className="mt-2 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => showPreview(v.id)}>
                      {preview?.id === v.id ? "Hide" : "Preview"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => restore(v.id)}
                      disabled={restoring === v.id}
                    >
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                      {restoring === v.id ? "Restoring…" : "Restore this version"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {error && (
            <p className="mt-3 rounded-md bg-red-50 p-2 text-sm text-red-800" role="alert">
              {error}
            </p>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
