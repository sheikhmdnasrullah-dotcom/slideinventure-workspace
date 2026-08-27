"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Folder, FileText, File, ChevronRight, Home } from "lucide-react";

type VentureNode = {
  id: string;
  path: string;
  name: string;
  type: "file" | "folder";
  children?: VentureNode[];
};

function findNode(tree: VentureNode | null, path: string): VentureNode | null {
  if (!tree) return null;
  if (tree.path === path) return tree;
  if (tree.children) {
    for (const child of tree.children) {
      const found = findNode(child, path);
      if (found) return found;
    }
  }
  return null;
}

function getChildren(tree: VentureNode | null, path: string): VentureNode[] {
  if (!tree) return [];
  if (!path) return tree.children ?? [];
  const node = findNode(tree, path);
  return node?.children ?? [];
}

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["md", "txt", "json", "csv", "yaml", "yml", "toml"].includes(ext)) return FileText;
  if (["pdf", "doc", "docx", "ppt", "xls"].includes(ext)) return FileText;
  return File;
}

export function AvFiles() {
  const [tree, setTree] = useState<VentureNode | null>(null);
  const [currentPath, setCurrentPath] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/ai-venture");
    const json = await res.json();
    setTree(json.tree ?? null);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const openFile = async (path: string) => {
    setSelected(path);
    setBusy(true);
    try {
      const res = await fetch(`/api/ai-venture/file?path=${encodeURIComponent(path)}`);
      const json = await res.json();
      setContent(json.content ?? "");
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await fetch("/api/ai-venture/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: selected, content }),
      });
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  const create = async (type: "file" | "folder") => {
    const path = window.prompt(`New ${type} path (e.g. PDF/notes.md)`);
    if (!path) return;
    await fetch("/api/ai-venture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, type }),
    }).catch(() => {});
    load();
  };

  const del = async (path: string) => {
    if (!window.confirm(`Delete ${path}?`)) return;
    await fetch(`/api/ai-venture/file?path=${encodeURIComponent(path)}`, { method: "DELETE" }).catch(() => {});
    if (selected === path) {
      setSelected(null);
      setContent("");
    }
    load();
  };

  const items = getChildren(tree, currentPath);
  const segments = currentPath ? currentPath.split("/") : [];

  return (
    <div className="grid h-full grid-cols-1 gap-3 lg:grid-cols-[1fr_400px]">
      <div className="flex flex-col rounded-lg border border-border">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setCurrentPath("")}
            disabled={!currentPath}
          >
            <Home className="size-3.5" />
          </Button>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {segments.length === 0 && <span className="text-foreground">Root</span>}
            {segments.map((seg, idx) => (
              <span key={idx} className="flex items-center gap-1">
                {idx > 0 && <ChevronRight className="size-3" />}
                <button
                  onClick={() => setCurrentPath(segments.slice(0, idx + 1).join("/"))}
                  className={`hover:text-foreground ${idx === segments.length - 1 ? "text-foreground" : ""}`}
                >
                  {seg}
                </button>
              </span>
            ))}
          </div>
          <div className="ml-auto flex gap-1">
            <Button size="xs" variant="outline" onClick={() => create("file")}>
              New file
            </Button>
            <Button size="xs" variant="outline" onClick={() => create("folder")}>
              New folder
            </Button>
          </div>
        </div>
        <ScrollArea className="flex-1 p-3">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground">This folder is empty.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {items.map((item) => {
                const Icon = item.type === "folder" ? Folder : fileIcon(item.name);
                return (
                  <button
                    key={item.id || item.path}
                    onClick={() => {
                      if (item.type === "folder") {
                        setCurrentPath(item.path);
                      } else {
                        openFile(item.path);
                      }
                    }}
                    className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border p-3 text-center text-xs hover:bg-accent"
                  >
                    <Icon className="size-8 text-muted-foreground" />
                    <span className="line-clamp-2">{item.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>
      <div className="flex flex-col rounded-lg border border-border">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <span className="truncate text-xs">{selected ?? "No file selected"}</span>
          <div className="ml-auto flex gap-1">
            <Button size="xs" onClick={save} disabled={!selected || busy}>
              Save
            </Button>
            {selected && (
              <Button size="xs" variant="outline" onClick={() => del(selected)}>
                Delete
              </Button>
            )}
          </div>
        </div>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={!selected}
          className="flex-1 resize-none rounded-none border-0 font-mono text-xs"
        />
      </div>
    </div>
  );
}
