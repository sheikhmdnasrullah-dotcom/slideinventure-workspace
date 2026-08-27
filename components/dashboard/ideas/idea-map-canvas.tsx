"use client";

import * as React from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  ConnectionMode,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type NodeProps,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type IdeaData = { label?: string };
type GraphNode = Node<IdeaData, "idea">;

type IdeaMapCtxValue = { onLabelChange: (id: string, label: string) => void };
const IdeaMapCtx = React.createContext<IdeaMapCtxValue | null>(null);

function IdeaNode({ id, data }: NodeProps) {
  const label = (data.label as string) ?? "Untitled";
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(label);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const ctx = React.useContext(IdeaMapCtx);

  React.useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const start = () => {
    setDraft(label);
    setEditing(true);
  };
  const commit = () => {
    setEditing(false);
    const next = draft.trim() || "Untitled";
    if (next !== label) ctx?.onLabelChange(id, next);
  };
  const cancel = () => {
    setEditing(false);
    setDraft(label);
  };

  return (
    <div className="min-w-[130px] rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm">
      <Handle id="t" type="source" position={Position.Top} className="!h-2.5 !w-2.5 !bg-primary" />
      <Handle id="b" type="source" position={Position.Bottom} className="!h-2.5 !w-2.5 !bg-primary" />
      <Handle id="l" type="source" position={Position.Left} className="!h-2.5 !w-2.5 !bg-primary" />
      <Handle id="r" type="source" position={Position.Right} className="!h-2.5 !w-2.5 !bg-primary" />
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          onBlur={commit}
          className="w-full bg-transparent text-foreground outline-none"
        />
      ) : (
        <div onDoubleClick={start} className="cursor-text select-none text-foreground">
          {label}
        </div>
      )}
    </div>
  );
}

const nodeTypes = { idea: IdeaNode };

type SaveStatus = "saved" | "saving" | "unsaved";

function toGraph(nodes: Node[], edges: Edge[]) {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: { label: (n.data?.label as string) ?? "Untitled" },
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
    })),
  };
}

function IdeaMapCanvasInner({ mapId }: { mapId: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const [nodes, setNodes, onNodesChangeRaw] = useNodesState<GraphNode>([]);
  const [edges, setEdges, onEdgesChangeRaw] = useEdgesState<Edge>([]);
  const [status, setStatus] = React.useState<SaveStatus>("saved");
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = React.useRef<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] });
  const statusRef = React.useRef<SaveStatus>("saved");
  const saveInFlight = React.useRef(false);

  latest.current = { nodes, edges };
  statusRef.current = status;

  const save = React.useCallback(async () => {
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    setStatus("saving");
    statusRef.current = "saving";
    const payload = JSON.stringify({ content: JSON.stringify(toGraph(latest.current.nodes, latest.current.edges)) });
    try {
      const res = await fetch(`/api/idea-maps/${mapId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
      if (!res.ok) throw new Error("save failed");
      setStatus("saved");
      statusRef.current = "saved";
      setSavedAt(new Date());
    } catch {
      setStatus("unsaved");
      statusRef.current = "unsaved";
      toast.error("Could not save idea map");
    } finally {
      saveInFlight.current = false;
    }
  }, [mapId]);

  const scheduleSave = React.useCallback(() => {
    setStatus("unsaved");
    statusRef.current = "unsaved";
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), 800);
  }, [save]);

  const flush = React.useCallback(() => {
    const payload = JSON.stringify({ content: JSON.stringify(toGraph(latest.current.nodes, latest.current.edges)) });
    try {
      fetch(`/api/idea-maps/${mapId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      });
    } catch {
      /* best effort on unload */
    }
  }, [mapId]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/idea-maps/${mapId}`);
      if (!res.ok) throw new Error("load failed");
      const json = await res.json();
      const parsed = JSON.parse(json.map?.content || "{}") as { nodes?: GraphNode[]; edges?: Edge[] };
      setNodes(parsed.nodes ?? []);
      setEdges(parsed.edges ?? []);
      setStatus("saved");
      statusRef.current = "saved";
      setSavedAt(new Date());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [mapId, setNodes, setEdges]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    const onUnload = () => {
      if (statusRef.current === "unsaved") flush();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [flush]);

  React.useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (statusRef.current === "unsaved") flush();
    };
  }, [flush]);

  const handleNodesChange = React.useCallback(
    (changes: NodeChange<GraphNode>[]) => {
      onNodesChangeRaw(changes);
      if (changes.some((c) => c.type !== "dimensions" && c.type !== "select")) scheduleSave();
    },
    [onNodesChangeRaw, scheduleSave]
  );

  const handleEdgesChange = React.useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChangeRaw(changes);
      if (changes.some((c) => c.type !== "select")) scheduleSave();
    },
    [onEdgesChangeRaw, scheduleSave]
  );

  const onConnect = React.useCallback(
    (conn: Connection) => {
      setEdges((eds) => addEdge(conn, eds));
      scheduleSave();
    },
    [setEdges, scheduleSave]
  );

  const onLabelChange = React.useCallback(
    (id: string, label: string) => {
      setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n)));
      scheduleSave();
    },
    [setNodes, scheduleSave]
  );

  const addNode = React.useCallback(() => {
    const id = `idea-${Date.now()}`;
    const bounds = containerRef.current?.getBoundingClientRect();
    const center = screenToFlowPosition({
      x: (bounds?.x ?? 0) + (bounds?.width ?? 800) / 2,
      y: (bounds?.y ?? 0) + (bounds?.height ?? 600) / 2,
    });
    setNodes((nds) => [
      ...nds,
      { id, type: "idea", position: center, data: { label: "New idea" } },
    ]);
    scheduleSave();
  }, [screenToFlowPosition, setNodes, scheduleSave]);

  const deleteSelected = React.useCallback(() => {
    setNodes((nds) => nds.filter((n) => !n.selected));
    setEdges((eds) => eds.filter((e) => !e.selected));
    scheduleSave();
  }, [setNodes, setEdges, scheduleSave]);

  const statusText =
    status === "saving"
      ? "Saving..."
      : status === "unsaved"
        ? "Unsaved"
        : savedAt
          ? `Saved ${savedAt.toLocaleTimeString()}`
          : "Saved";

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Skeleton className="h-[80%] w-[80%] rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">Could not load this idea map.</p>
        <Button size="sm" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <IdeaMapCtx.Provider value={{ onLabelChange }}>
      <div className="flex h-full w-full flex-col">
        <div className="flex items-center gap-2 border-b border-border p-2">
          <Button size="sm" onClick={addNode}>
            <Plus className="size-3" /> Add node
          </Button>
          <Button size="sm" variant="outline" onClick={deleteSelected}>
            <Trash2 className="size-3" /> Delete selected
          </Button>
          <span
            className={`ml-auto text-xs ${
              status === "unsaved" ? "text-amber-500" : status === "saving" ? "text-muted-foreground" : "text-emerald-500"
            }`}
          >
            {statusText}
          </span>
        </div>
        <div ref={containerRef} className="h-full w-full" data-lenis-prevent>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            connectionMode={ConnectionMode.Loose}
            fitView
            proOptions={{ hideAttribution: true }}
            nodesDraggable
            nodesConnectable
          >
            <Background gap={18} color="var(--border)" />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="!bg-card" />
          </ReactFlow>
        </div>
      </div>
    </IdeaMapCtx.Provider>
  );
}

export function IdeaMapCanvas({ mapId, className }: { mapId: string; className?: string }) {
  return (
    <ReactFlowProvider>
      <div className={className}>
        <IdeaMapCanvasInner mapId={mapId} />
      </div>
    </ReactFlowProvider>
  );
}
