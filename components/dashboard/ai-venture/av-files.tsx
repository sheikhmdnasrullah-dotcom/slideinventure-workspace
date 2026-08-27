"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

type VentureNode = {
  id: string;
  path: string;
  name: string;
  type: "file" | "folder";
  children?: VentureNode[];
};

function flatten(nodes: VentureNode[], depth = 0): { node: VentureNode; depth: number }[] {
  const out: { node: VentureNode; depth: number }[] = [];
  for (const n of nodes) {
    out.push({ node: n, depth });
    if (n.children) out.push(...flatten(n.children, depth + 1));
  }
  return out;
}

export function AvFiles() {
  const [tree, setTree] = useState<VentureNode | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [name, setName] = useState("");
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
      setName(json.name ?? path.split("/").pop() ?? "");
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
    setSelected(null);
    load();
  };

  const items = tree ? flatten(tree.children && tree.children.length ? tree.children : [tree]) : [];

  return (
    <div className="grid h-full grid-cols-[260px_1fr] gap-3">
      <div className="flex flex-col rounded-lg border border-border">
        <div className="flex items-center gap-2 border-b border-border px-2 py-1.5">
          <span className="text-xs font-medium">Files</span>
          <div className="ml-auto flex gap-1">
            <Button size="xs" variant="outline" onClick={() => create("file")}>
              New file
            </Button>
            <Button size="xs" variant="outline" onClick={() => create("folder")}>
              New folder
            </Button>
          </div>
        </div>
        <ScrollArea className="flex-1 p-1">
          {items.map(({ node, depth }) => (
            <button
              key={node.id || node.path}
              onClick={() => node.type === "file" && openFile(node.path)}
              disabled={node.type === "folder"}
              style={{ paddingLeft: 8 + depth * 12 }}
              className="flex w-full items-center gap-1 rounded px-1 py-1 text-left text-xs hover:bg-accent disabled:opacity-70"
            >
              <span className="truncate">{node.name}</span>
            </button>
          ))}
        </ScrollArea>
      </div>
      <div className="flex flex-col rounded-lg border border-border">
        <div className="flex items-center gap-2 border-b border-border px-2 py-1.5">
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
