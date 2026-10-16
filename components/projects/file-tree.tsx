"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  FileWarning,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  Search,
  Table2,
  Braces,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FileKind, SearchHit, TreeNode } from "./use-project";

function KindIcon({ kind, className }: { kind: FileKind | null; className?: string }) {
  const cls = cn("h-4 w-4 shrink-0 text-muted-foreground", className);
  switch (kind) {
    case "markdown":
    case "text":
      return <FileText className={cls} />;
    case "sql":
      return <Database className={cls} />;
    case "data":
      return <Table2 className={cls} />;
    case "document":
      return <Braces className={cls} />;
    case "image":
      return <ImageIcon className={cls} />;
    default:
      return <FileWarning className={cls} />;
  }
}

type Props = {
  tree: TreeNode[];
  activePath: string | null;
  dirtyPaths: Set<string>;
  onOpen: (path: string) => void;
  onSearch: (q: string) => Promise<SearchHit[]>;
};

function flattenFiles(nodes: TreeNode[], out: TreeNode[] = []): TreeNode[] {
  for (const n of nodes) {
    if (n.type === "file") out.push(n);
    else if (n.children) flattenFiles(n.children, out);
  }
  return out;
}

function TreeRow({
  node,
  depth,
  active,
  dirty,
  collapsed,
  onToggle,
  onOpen,
}: {
  node: TreeNode;
  depth: number;
  active: boolean;
  dirty: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  if (node.type === "folder") {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        {collapsed ? (
          <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate font-medium">{node.name}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      title={node.path}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
        active && "bg-muted font-medium"
      )}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <span className="w-3.5 shrink-0" />
      <KindIcon kind={node.kind} />
      <span className="truncate">{node.name}</span>
      {dirty && <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-amber-500" title="Unsaved changes" />}
    </button>
  );
}

export function FileTree({ tree, activePath, dirtyPaths, onOpen, onSearch }: Props) {
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [query, setQuery] = React.useState("");
  const [contentHits, setContentHits] = React.useState<SearchHit[] | null>(null);
  const [searching, setSearching] = React.useState(false);
  const debounce = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggle = React.useCallback((path: string) => {
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  // Debounced content search; name filtering is instant below.
  React.useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const q = query.trim();
    if (q.length < 2) {
      setContentHits(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounce.current = setTimeout(() => {
      onSearch(q)
        .then((hits) => setContentHits(hits))
        .catch(() => setContentHits([]))
        .finally(() => setSearching(false));
    }, 350);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, onSearch]);

  const nameMatches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return new Set(
      flattenFiles(tree)
        .filter((f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q))
        .map((f) => f.path)
    );
  }, [tree, query]);

  const renderNodes = (nodes: TreeNode[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      if (nameMatches && node.type === "file" && !nameMatches.has(node.path)) {
        // Still show folders that contain a match.
        if (node.type === "file") return null;
      }
      const isCollapsed = collapsed.has(node.path);
      return (
        <div key={node.path}>
          <TreeRow
            node={node}
            depth={depth}
            active={node.type === "file" && node.path === activePath}
            dirty={node.type === "file" && dirtyPaths.has(node.path)}
            collapsed={isCollapsed}
            onToggle={() => toggle(node.path)}
            onOpen={() => node.type === "file" && onOpen(node.path)}
          />
          {node.type === "folder" && !isCollapsed && node.children && (
            <>{renderNodes(node.children, depth + 1)}</>
          )}
        </div>
      );
    });

  const showContentResults = query.trim().length >= 2;

  return (
    <div className="flex h-full flex-col">
      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files and contents"
            className="pl-8"
            aria-label="Search files and contents"
          />
        </div>
      </div>
      <ScrollArea className="flex-1 px-1 pb-2">
        {tree.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No files yet. Create one or upload your project materials.
          </p>
        ) : (
          renderNodes(tree, 0)
        )}
        {showContentResults && (
          <div className="mt-2 border-t px-2 pt-2">
            <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
              {searching ? "Searching contents…" : "Inside files"}
            </p>
            {contentHits === null && !searching ? null : (contentHits ?? []).filter((h) => h.line > 0).length === 0 && !searching ? (
              <p className="px-1 py-1 text-xs text-muted-foreground">No content matches.</p>
            ) : (
              (contentHits ?? [])
                .filter((h) => h.line > 0)
                .slice(0, 20)
                .map((h, i) => (
                  <button
                    key={`${h.path}:${h.line}:${i}`}
                    type="button"
                    onClick={() => onOpen(h.path)}
                    className="block w-full truncate rounded-md px-2 py-1 text-left text-xs hover:bg-muted"
                    title={`${h.path}:${h.line}`}
                  >
                    <span className="font-medium">{h.path}</span>
                    <span className="text-muted-foreground">:{h.line}</span>
                    <span className="block truncate text-muted-foreground">{h.snippet}</span>
                  </button>
                ))
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
