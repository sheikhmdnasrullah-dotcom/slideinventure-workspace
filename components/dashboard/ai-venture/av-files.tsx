"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryState } from "nuqs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Folder,
  FileText,
  File,
  Image as ImageIcon,
  ChevronRight,
  Home,
  Upload,
  Pencil,
  Trash2,
  Download,
  LayoutGrid,
  List,
  Search,
  RefreshCw,
  FolderPlus,
  FilePlus,
  ArrowUp,
  ExternalLink,
  Code2,
  FileSpreadsheet,
  FileArchive,
  Save,
  Check,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { useLiveRefresh } from "@/components/providers/event-stream";
import { PdfEditorLink } from "@/components/dashboard/v3/documents/pdf-editor-link";
import { cn } from "@/lib/utils";

type VentureNode = {
  id: string;
  path: string;
  name: string;
  type: "file" | "folder";
  children?: VentureNode[];
};

const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"];
const BINARY_EXT = [...IMAGE_EXT, "pdf", "docx", "pptx", "xlsx", "zip"];

function extOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

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

function getFileTypeInfo(name: string, type: "file" | "folder") {
  if (type === "folder") {
    return {
      label: "Folder",
      icon: Folder,
      color: "#f59e0b",
      bgColor: "rgba(245, 158, 11, 0.12)",
      borderColor: "rgba(245, 158, 11, 0.25)",
    };
  }

  const ext = extOf(name);
  if (IMAGE_EXT.includes(ext)) {
    return {
      label: ext.toUpperCase(),
      icon: ImageIcon,
      color: "#8b5cf6",
      bgColor: "rgba(139, 92, 246, 0.12)",
      borderColor: "rgba(139, 92, 246, 0.25)",
    };
  }
  if (ext === "pdf") {
    return {
      label: "PDF",
      icon: FileText,
      color: "#ef4444",
      bgColor: "rgba(239, 68, 68, 0.12)",
      borderColor: "rgba(239, 68, 68, 0.25)",
    };
  }
  if (["csv", "xls", "xlsx"].includes(ext)) {
    return {
      label: ext.toUpperCase(),
      icon: FileSpreadsheet,
      color: "#10b981",
      bgColor: "rgba(16, 185, 129, 0.12)",
      borderColor: "rgba(16, 185, 129, 0.25)",
    };
  }
  if (["json", "yaml", "yml", "toml", "ts", "js", "html", "css"].includes(ext)) {
    return {
      label: ext.toUpperCase(),
      icon: Code2,
      color: "#06b6d4",
      bgColor: "rgba(6, 182, 212, 0.12)",
      borderColor: "rgba(6, 182, 212, 0.25)",
    };
  }
  if (["zip", "tar", "gz", "rar"].includes(ext)) {
    return {
      label: ext.toUpperCase(),
      icon: FileArchive,
      color: "#ec4899",
      bgColor: "rgba(236, 72, 153, 0.12)",
      borderColor: "rgba(236, 72, 153, 0.25)",
    };
  }
  return {
    label: ext ? ext.toUpperCase() : "FILE",
    icon: FileText,
    color: "#64748b",
    bgColor: "rgba(100, 116, 139, 0.12)",
    borderColor: "rgba(100, 116, 139, 0.25)",
  };
}

export function AvFiles() {
  const [deepLinkPath, setDeepLinkPath] = useQueryState("path");
  const [tree, setTree] = useState<VentureNode | null>(null);
  const [currentPath, setCurrentPath] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  // Modals state
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    type: "new-file" | "new-folder" | "rename" | "delete";
    targetPath?: string;
    value: string;
  }>({
    open: false,
    type: "new-file",
    value: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-venture");
      const json = await res.json();
      setTree(json.tree ?? null);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useLiveRefresh(load, { types: ["file."] });

  const selectedExt = selected ? extOf(selected) : "";
  const isBinarySelected = BINARY_EXT.includes(selectedExt);
  const isImageSelected = IMAGE_EXT.includes(selectedExt);

  const openFile = async (path: string) => {
    setSelected(path);
    const ext = extOf(path);
    if (BINARY_EXT.includes(ext)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/ai-venture/file?path=${encodeURIComponent(path)}`);
      const json = await res.json();
      setContent(json.content ?? "");
    } catch {
      toast.error("Could not open file");
    } finally {
      setBusy(false);
    }
  };

  // Deep link from Research Lab ("Open source"): once the tree has loaded,
  // jump straight to the referenced file and its folder, then drop the query
  // param so it doesn't re-trigger on subsequent navigation within Files.
  useEffect(() => {
    if (!tree || !deepLinkPath) return;
    const folder = deepLinkPath.includes("/") ? deepLinkPath.slice(0, deepLinkPath.lastIndexOf("/")) : "";
    setCurrentPath(folder);
    openFile(deepLinkPath);
    void setDeepLinkPath(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, deepLinkPath]);

  const save = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch("/api/ai-venture/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: selected, content }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("File saved successfully");
    } catch {
      toast.error("Failed to save file");
    } finally {
      setBusy(false);
    }
  };

  // Keyboard shortcut Cmd+S / Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s" && selected && !isBinarySelected) {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selected, isBinarySelected, content]);

  const handleDialogSubmit = async () => {
    const { type, value, targetPath } = dialogState;
    if (!value.trim() && type !== "delete") return;

    try {
      if (type === "new-file" || type === "new-folder") {
        const itemType = type === "new-file" ? "file" : "folder";
        const path = currentPath ? `${currentPath}/${value.trim()}` : value.trim();
        const res = await fetch("/api/ai-venture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path, type: itemType }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error?.message || "Create failed");
        }
        toast.success(`Created ${value.trim()}`);
        load();
      } else if (type === "rename" && targetPath) {
        const base = targetPath.includes("/")
          ? targetPath.slice(0, targetPath.lastIndexOf("/") + 1)
          : "";
        const newPath = base + value.trim();
        if (newPath === targetPath) {
          setDialogState((s) => ({ ...s, open: false }));
          return;
        }
        const res = await fetch("/api/ai-venture/file", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: targetPath, newPath }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error?.message || "Rename failed");
        }
        toast.success(`Renamed to ${value.trim()}`);
        if (selected === targetPath) setSelected(newPath);
        load();
      } else if (type === "delete" && targetPath) {
        const res = await fetch(
          `/api/ai-venture/file?path=${encodeURIComponent(targetPath)}`,
          { method: "DELETE" }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error?.message || "Delete failed");
        }
        toast.success(`Deleted ${targetPath.split("/").pop()}`);
        if (selected === targetPath) {
          setSelected(null);
          setContent("");
        }
        load();
      }
      setDialogState((s) => ({ ...s, open: false }));
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", currentPath);
      const res = await fetch("/api/ai-venture/upload", { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || "Upload failed");
      }
      toast.success(`Uploaded ${file.name}`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) uploadFile(file);
  };

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const rawItems = getChildren(tree, currentPath);

  // Filter items by search query
  const items = useMemo(() => {
    if (!searchQuery.trim()) return rawItems;
    const q = searchQuery.toLowerCase().trim();
    return rawItems.filter((i) => i.name.toLowerCase().includes(q));
  }, [rawItems, searchQuery]);

  const segments = currentPath ? currentPath.split("/") : [];

  const handleGoUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split("/");
    parts.pop();
    setCurrentPath(parts.join("/"));
  };

  return (
    <div
      data-droppable="files"
      data-drop-title="AI Venture Files"
      className="grid h-full grid-cols-1 gap-3 p-3 lg:grid-cols-[1fr_440px]"
    >
      {/* Left Pane: Files & Folders Explorer */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col rounded-xl border border-rule bg-card/50 shadow-xs transition-colors overflow-hidden",
          isDragOver && "border-primary bg-primary/5 ring-2 ring-primary/20"
        )}
      >
        {/* Breadcrumb & Navigation Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule bg-muted/30 px-3.5 py-2.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => setCurrentPath("")}
              disabled={!currentPath}
              className="size-7"
              title="Root directory"
            >
              <Home className="size-3.5" />
            </Button>

            {currentPath && (
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={handleGoUp}
                className="size-7"
                title="Up one folder"
              >
                <ArrowUp className="size-3.5" />
              </Button>
            )}

            <div className="flex items-center gap-1 overflow-x-auto text-xs text-muted-foreground">
              {segments.length === 0 ? (
                <span className="font-semibold text-foreground">Root</span>
              ) : (
                <button
                  onClick={() => setCurrentPath("")}
                  className="font-medium hover:text-foreground transition-colors"
                >
                  Root
                </button>
              )}
              {segments.map((seg, idx) => (
                <span key={idx} className="flex items-center gap-1">
                  <ChevronRight className="size-3 text-muted-foreground/50 shrink-0" />
                  <button
                    onClick={() => setCurrentPath(segments.slice(0, idx + 1).join("/"))}
                    className={cn(
                      "truncate max-w-[140px] hover:text-foreground transition-colors",
                      idx === segments.length - 1 ? "font-semibold text-foreground" : "font-medium"
                    )}
                    title={seg}
                  >
                    {seg}
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Action Buttons & View Mode */}
          <div className="flex items-center gap-1.5 ml-auto">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelected}
            />

            <Button
              size="xs"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="h-7 gap-1.5 text-xs font-medium shadow-xs"
            >
              <Upload className="size-3" />
              {uploading ? "Uploading…" : "Upload"}
            </Button>

            <Button
              size="xs"
              variant="outline"
              onClick={() =>
                setDialogState({
                  open: true,
                  type: "new-file",
                  value: "",
                })
              }
              className="h-7 gap-1 text-xs"
            >
              <FilePlus className="size-3" />
              New file
            </Button>

            <Button
              size="xs"
              variant="outline"
              onClick={() =>
                setDialogState({
                  open: true,
                  type: "new-folder",
                  value: "",
                })
              }
              className="h-7 gap-1 text-xs"
            >
              <FolderPlus className="size-3" />
              New folder
            </Button>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-md border border-rule bg-background p-0.5 ml-1">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                title="Grid view"
                className={cn(
                  "rounded p-1 transition-colors",
                  viewMode === "grid"
                    ? "bg-muted text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutGrid className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                title="List view"
                className={cn(
                  "rounded p-1 transition-colors",
                  viewMode === "list"
                    ? "bg-muted text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <List className="size-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Search & Stats Bar */}
        <div className="flex items-center justify-between gap-3 border-b border-rule/60 bg-background/50 px-3.5 py-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search in this folder…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7.5 pl-8 text-xs bg-card/60"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {items.length} item{items.length !== 1 ? "s" : ""}
            </span>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={load}
              className="size-6"
              title="Refresh files"
            >
              <RefreshCw className="size-3" />
            </Button>
          </div>
        </div>

        {/* File & Folder Area */}
        <ScrollArea className="flex-1 p-4">
          {items.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center text-muted-foreground">
              <Folder className="size-10 mb-2 opacity-30 text-muted-foreground" />
              <p className="text-sm font-medium text-ink-strong">This folder is empty</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Drag and drop files here, or use the buttons above to create files and folders.
              </p>
            </div>
          ) : viewMode === "grid" ? (
            /* Adaptive Responsive Grid: Cards NEVER squish or overlap */
            <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3.5">
              {items.map((item) => {
                const info = getFileTypeInfo(item.name, item.type);
                const Icon = info.icon;
                const isSelected = selected === item.path;
                const ext = extOf(item.name);
                const isImage = IMAGE_EXT.includes(ext);

                return (
                  <div
                    key={item.id || item.path}
                    onClick={() => {
                      if (item.type === "folder") {
                        setCurrentPath(item.path);
                      } else {
                        openFile(item.path);
                      }
                    }}
                    className={cn(
                      "group relative flex flex-col items-center justify-between rounded-xl border p-3.5 text-center transition-all duration-150 cursor-pointer select-none",
                      isSelected
                        ? "border-primary bg-primary/10 ring-1 ring-primary shadow-sm"
                        : "border-rule bg-card/60 hover:-translate-y-0.5 hover:border-rule-strong hover:bg-card hover:shadow-sm"
                    )}
                  >
                    {/* Action buttons (Rename, Delete) */}
                    <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button
                        type="button"
                        aria-label="Rename"
                        title="Rename"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDialogState({
                            open: true,
                            type: "rename",
                            targetPath: item.path,
                            value: item.name,
                          });
                        }}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <Pencil className="size-3" />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete"
                        title="Delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDialogState({
                            open: true,
                            type: "delete",
                            targetPath: item.path,
                            value: item.name,
                          });
                        }}
                        className="rounded p-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>

                    {/* Thumbnail / Icon Container */}
                    <div className="flex size-14 items-center justify-center my-1">
                      {isImage && item.type === "file" ? (
                        <div className="relative size-13 overflow-hidden rounded-lg ring-1 ring-rule shadow-2xs">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/api/ai-venture/file/raw?path=${encodeURIComponent(item.path)}`}
                            alt={item.name}
                            className="size-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div
                          className="flex size-13 items-center justify-center rounded-xl transition-transform group-hover:scale-105"
                          style={{
                            background: info.bgColor,
                            color: info.color,
                            boxShadow: `inset 0 0 0 1px ${info.borderColor}`,
                          }}
                        >
                          <Icon
                            className={cn(
                              "size-7",
                              item.type === "folder" && "fill-amber-500/30"
                            )}
                          />
                        </div>
                      )}
                    </div>

                    {/* Name & Type Tag - Full width with clean wrapping */}
                    <div className="w-full mt-2 space-y-0.5">
                      <p
                        className="w-full text-center text-xs font-medium text-ink-strong leading-tight break-words line-clamp-2"
                        title={item.name}
                      >
                        {item.name}
                      </p>
                      <span className="inline-block text-[10px] text-ink-muted">
                        {info.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* List View Mode */
            <div className="overflow-hidden rounded-xl border border-rule bg-card/40">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-rule bg-muted/40 font-label">
                    <th className="px-3.5 py-2.5 text-left font-medium text-ink-muted">Name</th>
                    <th className="px-3.5 py-2.5 text-left font-medium text-ink-muted">Type</th>
                    <th className="px-3.5 py-2.5 text-right font-medium text-ink-muted">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule font-body-tight">
                  {items.map((item) => {
                    const info = getFileTypeInfo(item.name, item.type);
                    const Icon = info.icon;
                    const isSelected = selected === item.path;

                    return (
                      <tr
                        key={item.id || item.path}
                        onClick={() => {
                          if (item.type === "folder") {
                            setCurrentPath(item.path);
                          } else {
                            openFile(item.path);
                          }
                        }}
                        className={cn(
                          "hover:bg-muted/40 transition-colors cursor-pointer",
                          isSelected && "bg-primary/10 font-medium"
                        )}
                      >
                        <td className="px-3.5 py-2 text-ink-strong">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="flex size-7 items-center justify-center rounded-md shrink-0"
                              style={{ background: info.bgColor, color: info.color }}
                            >
                              <Icon className="size-4" />
                            </span>
                            <span className="truncate max-w-[280px]" title={item.name}>
                              {item.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-3.5 py-2 text-ink-muted">{info.label}</td>
                        <td className="px-3.5 py-2 text-right">
                          <div
                            className="flex items-center justify-end gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {item.type === "file" && (
                              <a
                                href={`/api/ai-venture/file/raw?path=${encodeURIComponent(item.path)}`}
                                download
                                target="_blank"
                                rel="noreferrer"
                                className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
                                title="Download"
                              >
                                <Download className="size-3.5" />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setDialogState({
                                  open: true,
                                  type: "rename",
                                  targetPath: item.path,
                                  value: item.name,
                                })
                              }
                              className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
                              title="Rename"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDialogState({
                                  open: true,
                                  type: "delete",
                                  targetPath: item.path,
                                  value: item.name,
                                })
                              }
                              className="rounded p-1 text-muted-foreground hover:text-rose-500 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right Pane: File Preview / Code & Text Editor */}
      <div className="flex flex-col rounded-xl border border-rule bg-card/50 shadow-xs overflow-hidden">
        {/* Preview Header */}
        <div className="flex items-center justify-between gap-2 border-b border-rule bg-muted/30 px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            {selected ? (
              <>
                <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0">
                  {selectedExt || "FILE"}
                </Badge>
                <span className="truncate text-xs font-semibold text-ink-strong" title={selected}>
                  {selected.split("/").pop()}
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">No file selected</span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {selected && !isBinarySelected && (
              <Button
                size="xs"
                onClick={save}
                disabled={busy}
                className="h-7 gap-1 text-xs font-medium shadow-xs"
              >
                <Save className="size-3" />
                {busy ? "Saving…" : "Save"}
              </Button>
            )}

            {selected && (
              <>
                <Button
                  size="icon-xs"
                  variant="outline"
                  onClick={() =>
                    setDialogState({
                      open: true,
                      type: "rename",
                      targetPath: selected,
                      value: selected.split("/").pop() || "",
                    })
                  }
                  className="size-7"
                  title="Rename file"
                >
                  <Pencil className="size-3" />
                </Button>

                <a
                  href={`/api/ai-venture/file/raw?path=${encodeURIComponent(selected)}`}
                  download
                  target="_blank"
                  rel="noreferrer"
                  title="Download file"
                >
                  <Button size="icon-xs" variant="outline" className="size-7">
                    <Download className="size-3" />
                  </Button>
                </a>

                <Button
                  size="icon-xs"
                  variant="outline"
                  onClick={() =>
                    setDialogState({
                      open: true,
                      type: "delete",
                      targetPath: selected,
                      value: selected.split("/").pop() || "",
                    })
                  }
                  className="size-7 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                  title="Delete file"
                >
                  <Trash2 className="size-3" />
                </Button>

                {selectedExt === "pdf" && <PdfEditorLink label="PDF Editor" size="xs" />}
              </>
            )}
          </div>
        </div>

        {/* Preview Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-muted-foreground">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/40 mb-3 text-muted-foreground/60 ring-1 ring-rule">
                <Eye className="size-7" />
              </div>
              <p className="text-sm font-semibold text-ink-strong">No File Selected</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
                Click any file on the left to inspect, preview, edit, or download it.
              </p>
            </div>
          ) : isImageSelected ? (
            <div className="flex flex-1 items-center justify-center overflow-auto p-6 bg-muted/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/ai-venture/file/raw?path=${encodeURIComponent(selected)}`}
                alt={selected}
                className="max-h-full max-w-full rounded-lg object-contain ring-1 ring-rule shadow-sm"
              />
            </div>
          ) : selectedExt === "pdf" ? (
            <iframe
              src={`/api/ai-venture/file/raw?path=${encodeURIComponent(selected)}`}
              className="flex-1 size-full border-0"
              title={selected}
            />
          ) : isBinarySelected ? (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-muted-foreground">
              <File className="size-10 mb-2 opacity-40" />
              <p className="text-sm font-semibold text-ink-strong">Binary Document</p>
              <p className="text-xs text-muted-foreground mt-1">
                Inline preview not available for this format.
              </p>
              <a
                href={`/api/ai-venture/file/raw?path=${encodeURIComponent(selected)}`}
                download
                className="mt-3"
              >
                <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                  <Download className="size-3.5" /> Download to view
                </Button>
              </a>
            </div>
          ) : (
            <div className="flex flex-1 flex-col overflow-hidden">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={!selected || busy}
                placeholder="Start typing file content..."
                className="flex-1 w-full resize-none rounded-none border-0 p-4 font-mono text-xs leading-relaxed outline-none focus-visible:ring-0"
              />
              <div className="flex items-center justify-between border-t border-rule/60 bg-muted/20 px-3.5 py-1.5 text-[11px] text-muted-foreground font-mono">
                <span>{content.length} characters</span>
                <span className="text-ink-faint">Press Cmd+S to save</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Dialog (New File, New Folder, Rename, Delete) */}
      <Dialog
        open={dialogState.open}
        onOpenChange={(open) => setDialogState((s) => ({ ...s, open }))}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogState.type === "new-file" && "Create New File"}
              {dialogState.type === "new-folder" && "Create New Folder"}
              {dialogState.type === "rename" && "Rename"}
              {dialogState.type === "delete" && "Confirm Deletion"}
            </DialogTitle>
            <DialogDescription>
              {dialogState.type === "new-file" &&
                `Enter a name for the new file in ${currentPath ? `/${currentPath}` : "root"}.`}
              {dialogState.type === "new-folder" &&
                `Enter a name for the new folder in ${currentPath ? `/${currentPath}` : "root"}.`}
              {dialogState.type === "rename" && `Enter a new name for "${dialogState.targetPath?.split("/").pop()}".`}
              {dialogState.type === "delete" &&
                `Are you sure you want to permanently delete "${dialogState.targetPath?.split("/").pop()}"? This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>

          {dialogState.type !== "delete" ? (
            <div className="py-2">
              <Input
                autoFocus
                value={dialogState.value}
                onChange={(e) => setDialogState((s) => ({ ...s, value: e.target.value }))}
                placeholder={
                  dialogState.type === "new-file"
                    ? "notes.md"
                    : dialogState.type === "new-folder"
                    ? "My Folder"
                    : "New name"
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleDialogSubmit();
                  }
                }}
              />
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogState((s) => ({ ...s, open: false }))}
            >
              Cancel
            </Button>
            <Button
              variant={dialogState.type === "delete" ? "destructive" : "default"}
              size="sm"
              onClick={handleDialogSubmit}
              disabled={dialogState.type !== "delete" && !dialogState.value.trim()}
            >
              {dialogState.type === "delete" ? "Delete" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
