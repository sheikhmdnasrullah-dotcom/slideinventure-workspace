"use client";

import * as React from "react";
import type {
  FileKind,
  FileVersion,
  Project,
  ProjectFile,
  Proposal,
  SearchHit,
  TreeNode,
} from "@/lib/project-workspace/types";

export type { Project, ProjectFile, Proposal, SearchHit, TreeNode, FileVersion, FileKind };

export class ProjectApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;
  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
  get isConflict() {
    return this.status === 409;
  }
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
    details?: Record<string, unknown>;
  } & T;
  if (!res.ok) {
    throw new ProjectApiError(res.status, data.code ?? "ERROR", data.error ?? res.statusText, data.details);
  }
  return data;
}

const enc = (p: string) => p.split("/").map(encodeURIComponent).join("/");

export const projectApi = {
  list: () => req<{ projects: Project[] }>("/api/projects"),
  create: (name: string, description?: string) =>
    req<{ project: Project }>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    }),
  get: (id: string) => req<{ project: Project }>(`/api/projects/${id}`),
  remove: (id: string) =>
    req<{ status: string }>(`/api/projects/${id}`, { method: "DELETE" }),

  tree: (id: string) => req<{ tree: TreeNode[] }>(`/api/projects/${id}/files`),
  read: (id: string, path: string) =>
    req<{ file: ProjectFile }>(`/api/projects/${id}/files/${enc(path)}`),
  createFile: (id: string, path: string, content: string) =>
    req<{ file: ProjectFile }>(`/api/projects/${id}/files`, {
      method: "POST",
      body: JSON.stringify({ type: "file", path, content }),
    }),
  createFolder: (id: string, path: string) =>
    req<{ folder: TreeNode }>(`/api/projects/${id}/files`, {
      method: "POST",
      body: JSON.stringify({ type: "folder", path }),
    }),
  save: (id: string, path: string, content: string, expectedHash: string) =>
    req<{ file: ProjectFile }>(`/api/projects/${id}/files/${enc(path)}`, {
      method: "PUT",
      body: JSON.stringify({ content, expectedHash }),
    }),
  move: (id: string, path: string, toDir: string, newName?: string) =>
    req<{ path: string }>(`/api/projects/${id}/files/${enc(path)}`, {
      method: "PATCH",
      body: JSON.stringify({ toDir, newName }),
    }),
  removeFile: (id: string, path: string) =>
    req<{ status: string }>(`/api/projects/${id}/files/${enc(path)}`, { method: "DELETE" }),
  upload: async (id: string, file: File, folder: string) => {
    const form = new FormData();
    form.append("file", file);
    form.append("folder", folder);
    const res = await fetch(`/api/projects/${id}/upload`, { method: "POST", body: form });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
      path?: string;
      sizeBytes?: number;
      hash?: string;
    };
    if (!res.ok) throw new ProjectApiError(res.status, data.code ?? "ERROR", data.error ?? res.statusText);
    return data;
  },

  search: (id: string, q: string) =>
    req<{ hits: SearchHit[] }>(`/api/projects/${id}/search?q=${encodeURIComponent(q)}`),

  versions: (id: string, path: string) =>
    req<{ versions: Omit<FileVersion, "content">[] }>(
      `/api/projects/${id}/files/${enc(path)}?versions=1`
    ),
  versionContent: (id: string, path: string, versionId: string) =>
    req<{ version: FileVersion }>(
      `/api/projects/${id}/files/${enc(path)}?version=${encodeURIComponent(versionId)}`
    ),
  restore: (id: string, path: string, versionId: string, expectedHash: string) =>
    req<{ file: ProjectFile }>(`/api/projects/${id}/files/${enc(path)}`, {
      method: "POST",
      body: JSON.stringify({ action: "restore", versionId, expectedHash }),
    }),

  proposals: (id: string, status?: string) =>
    req<{ proposals: Proposal[] }>(
      `/api/projects/${id}/proposals${status ? `?status=${status}` : ""}`
    ),
  decideProposal: (id: string, proposalId: string, action: "accept" | "reject") =>
    req<{ proposal: Proposal; file?: ProjectFile }>(
      `/api/projects/${id}/proposals/${proposalId}`,
      { method: "POST", body: JSON.stringify({ action }) }
    ),

  downloadUrl: (id: string, path: string, download = false) =>
    `/api/projects/${id}/files/${enc(path)}?raw=1${download ? "&attachment=1" : ""}`,
};

export type OpenTab = {
  path: string;
  /** Last saved server state (null while loading). */
  file: ProjectFile | null;
  /** Draft the user is editing; undefined means "same as saved". */
  draft?: string;
  loading: boolean;
  error: string | null;
};

export type SaveState = "saved" | "unsaved" | "saving" | "error";

type WorkspaceState = {
  project: Project | null;
  tree: TreeNode[];
  treeLoading: boolean;
  treeError: string | null;
  tabs: OpenTab[];
  activePath: string | null;
  proposals: Proposal[];
  proposalsLoading: boolean;
};

export function useProjectWorkspace(projectId: string) {
  const [state, setState] = React.useState<WorkspaceState>({
    project: null,
    tree: [],
    treeLoading: true,
    treeError: null,
    tabs: [],
    activePath: null,
    proposals: [],
    proposalsLoading: true,
  });

  const patch = React.useCallback((p: Partial<WorkspaceState>) => {
    setState((s) => ({ ...s, ...p }));
  }, []);

  const refreshTree = React.useCallback(async () => {
    try {
      const [{ project }, { tree }] = await Promise.all([
        projectApi.get(projectId),
        projectApi.tree(projectId),
      ]);
      setState((s) => ({ ...s, project, tree, treeLoading: false, treeError: null }));
    } catch (e) {
      setState((s) => ({
        ...s,
        treeLoading: false,
        treeError: e instanceof Error ? e.message : "Couldn't load project files",
      }));
    }
  }, [projectId]);

  const refreshProposals = React.useCallback(async () => {
    try {
      const { proposals } = await projectApi.proposals(projectId);
      setState((s) => ({ ...s, proposals, proposalsLoading: false }));
    } catch {
      setState((s) => ({ ...s, proposalsLoading: false }));
    }
  }, [projectId]);

  React.useEffect(() => {
    refreshTree();
    refreshProposals();
  }, [refreshTree, refreshProposals]);

  const openFile = React.useCallback(
    async (path: string) => {
      setState((s) => {
        const existing = s.tabs.find((t) => t.path === path);
        if (existing) return { ...s, activePath: path };
        return {
          ...s,
          activePath: path,
          tabs: [...s.tabs, { path, file: null, loading: true, error: null }],
        };
      });
      try {
        const { file } = await projectApi.read(projectId, path);
        setState((s) => ({
          ...s,
          tabs: s.tabs.map((t) => (t.path === path ? { ...t, file, loading: false } : t)),
        }));
      } catch (e) {
        setState((s) => ({
          ...s,
          tabs: s.tabs.map((t) =>
            t.path === path
              ? { ...t, loading: false, error: e instanceof Error ? e.message : "Couldn't open file" }
              : t
          ),
        }));
      }
    },
    [projectId]
  );

  const closeTab = React.useCallback((path: string) => {
    setState((s) => {
      const tabs = s.tabs.filter((t) => t.path !== path);
      const activePath =
        s.activePath === path ? (tabs[tabs.length - 1]?.path ?? null) : s.activePath;
      return { ...s, tabs, activePath };
    });
  }, []);

  const setActive = React.useCallback((path: string | null) => {
    setState((s) => ({ ...s, activePath: path }));
  }, []);

  const setDraft = React.useCallback((path: string, draft: string) => {
    setState((s) => ({
      ...s,
      tabs: s.tabs.map((t) => (t.path === path ? { ...t, draft } : t)),
    }));
  }, []);

  /** Save the active draft; returns the outcome for honest status display. */
  const saveTab = React.useCallback(
    async (path: string): Promise<{ ok: boolean; message: string }> => {
      const tab = state.tabs.find((t) => t.path === path);
      if (!tab?.file || tab.draft === undefined) return { ok: true, message: "No changes" };
      try {
        const { file } = await projectApi.save(projectId, path, tab.draft, tab.file.hash);
        setState((s) => ({
          ...s,
          tabs: s.tabs.map((t) =>
            t.path === path ? { ...t, file, draft: undefined } : t
          ),
        }));
        refreshTree();
        return { ok: true, message: "Saved" };
      } catch (e) {
        if (e instanceof ProjectApiError && e.isConflict) {
          return {
            ok: false,
            message:
              "This file changed elsewhere since you opened it. Reload the file to see the latest version, then re-apply your edits.",
          };
        }
        return { ok: false, message: e instanceof Error ? e.message : "Save failed" };
      }
    },
    [projectId, state.tabs, refreshTree]
  );

  const reloadTab = React.useCallback(
    async (path: string) => {
      setState((s) => ({
        ...s,
        tabs: s.tabs.map((t) => (t.path === path ? { ...t, loading: true, error: null } : t)),
      }));
      try {
        const { file } = await projectApi.read(projectId, path);
        setState((s) => ({
          ...s,
          tabs: s.tabs.map((t) =>
            t.path === path ? { ...t, file, draft: undefined, loading: false } : t
          ),
        }));
      } catch (e) {
        setState((s) => ({
          ...s,
          tabs: s.tabs.map((t) =>
            t.path === path
              ? { ...t, loading: false, error: e instanceof Error ? e.message : "Couldn't reload" }
              : t
          ),
        }));
      }
    },
    [projectId]
  );

  /** Update a tab in place after an accepted proposal / restore. */
  const replaceTabFile = React.useCallback((file: ProjectFile) => {
    setState((s) => ({
      ...s,
      tabs: s.tabs.map((t) =>
        t.path === file.path ? { ...t, file, draft: undefined, loading: false, error: null } : t
      ),
    }));
  }, []);

  return {
    ...state,
    patch,
    refreshTree,
    refreshProposals,
    openFile,
    closeTab,
    setActive,
    setDraft,
    saveTab,
    reloadTab,
    replaceTabFile,
    activeTab: state.tabs.find((t) => t.path === state.activePath) ?? null,
  };
}

export type ProjectWorkspace = ReturnType<typeof useProjectWorkspace>;
