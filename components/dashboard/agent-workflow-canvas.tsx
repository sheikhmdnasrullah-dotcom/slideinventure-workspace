"use client";

import * as React from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ShimmerButton } from "@/components/ui/magicui/shimmer-button";
import { cn } from "@/lib/utils";
import { Search, Brain, Wrench, Video, Send, Zap, CircleCheck, CircleX, Trash2, type LucideIcon } from "lucide-react";

type NodeKind = "trigger" | "research" | "reason" | "output" | "tool" | "youtube";
type Status = "idle" | "running" | "done" | "error";

type AgentNodeData = {
  label: string;
  kind: NodeKind;
  status: Status;
  instruction: string;
  result: string;
};

type LogEntry = { level: "info" | "success" | "error"; text: string };

const LOG_ICON: Record<LogEntry["level"], LucideIcon | null> = {
  info: null,
  success: CircleCheck,
  error: CircleX,
};

const KIND_META: Record<NodeKind, { icon: LucideIcon }> = {
  trigger: { icon: Zap },
  research: { icon: Search },
  reason: { icon: Brain },
  tool: { icon: Wrench },
  youtube: { icon: Video },
  output: { icon: Send },
};

const STATUS_RING: Record<Status, string> = {
  idle: "border-border",
  running: "border-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.5)]",
  done: "border-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.45)]",
  error: "border-rose-400 shadow-[0_0_18px_rgba(244,63,94,0.45)]",
};

function AgentNode({ id, data }: NodeProps) {
  const d = data as AgentNodeData;
  const meta = KIND_META[d.kind];
  const { deleteElements, getEdges } = useReactFlow();
  const onDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const connected = getEdges()
      .filter((edge) => edge.source === id || edge.target === id)
      .map((edge) => ({ id: edge.id }));
    deleteElements({ nodes: [{ id }], edges: connected });
  };
  return (
    <div
      className={`group relative w-52 rounded-xl border bg-card/80 p-3 backdrop-blur ${STATUS_RING[d.status]}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-primary" />
      <button
        onClick={onDelete}
        title="Delete node"
        className="absolute right-1.5 top-1.5 z-10 hidden rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:block"
      >
        <Trash2 className="size-3.5" />
      </button>
      <div className="flex items-center gap-2">
        <meta.icon className="size-4 text-ink-strong" />
        <span className="text-xs font-semibold">{d.label}</span>
      </div>
      {d.instruction && (
        <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">{d.instruction}</p>
      )}
      {d.result && (
        <p className="mt-2 max-h-16 overflow-auto rounded bg-muted/60 p-1.5 text-[10px] text-emerald-300">
          {d.result}
        </p>
      )}
      <span className="mt-2 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {d.status}
      </span>
      <Handle type="source" position={Position.Right} className="!bg-primary" />
    </div>
  );
}

const nodeTypes = { agent: AgentNode };

function mkNode(id: string, kind: NodeKind, label: string, instruction: string, x: number): Node {
  return {
    id,
    type: "agent",
    position: { x, y: 0 },
    data: {
      label,
      kind,
      status: "idle",
      instruction,
      result: "",
    } as AgentNodeData,
  };
}

export function AgentWorkflowCanvas({
  slug,
  name,
  persona,
}: {
  slug: string;
  name: string;
  persona: string;
}) {
  const [input, setInput] = React.useState("");
  const [planning, setPlanning] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [output, setOutput] = React.useState("");
  const [log, setLog] = React.useState<LogEntry[]>([]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const researchRef = React.useRef("");

  const setStatus = React.useCallback(
    (id: string, status: Status) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, status } } : n)),
      );
    },
    [setNodes],
  );

  const setResult = React.useCallback(
    (id: string, result: string) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, result } } : n)),
      );
    },
    [setNodes],
  );

  function defaultGraph() {
    const t = mkNode("trigger", "trigger", "Trigger", "User request", 0);
    const r = mkNode("research", "research", "Research (web)", "Browse the web for context", 260);
    const re = mkNode("reason", "reason", "Reason (DeepSeek)", "Think with DeepSeek", 520);
    const o = mkNode("output", "output", "Output", "Deliver result", 780);
    setNodes([t, r, re, o]);
    setEdges([
      { id: "e1", source: "trigger", target: "research" },
      { id: "e2", source: "research", target: "reason" },
      { id: "e3", source: "reason", target: "output" },
    ]);
  }

  React.useEffect(() => {
    defaultGraph();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function buildGraph() {
    if (!input.trim() || planning) return;
    setPlanning(true);
    setLog([{ level: "info", text: `Planning "${name}" workflow...` }]);
    try {
      const res = await fetch(`/api/agents/${slug}/plan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: input, persona }),
      });
      const data = await res.json();
      const steps: { kind: NodeKind; label: string; instruction: string }[] =
        Array.isArray(data.steps) ? data.steps : [];
      const trigger = mkNode("trigger", "trigger", "Trigger", input, 0);
      const built: Node[] = [trigger];
      const builtEdges: Edge[] = [];
      let prev = "trigger";
      steps.forEach((s, i) => {
        const id = `n${i}`;
      const kind = (["research", "reason", "output", "tool", "youtube"].includes(s.kind)
        ? s.kind
        : "reason") as NodeKind;
        built.push(mkNode(id, kind, s.label || kind, s.instruction || "", (i + 1) * 260));
        builtEdges.push({ id: `e${i}`, source: prev, target: id });
        prev = id;
      });
      if (!builtEdges.length) {
        built.push(mkNode("output", "output", "Output", "Deliver result", 260));
        builtEdges.push({ id: "e0", source: "trigger", target: "output" });
      }
      setNodes(built);
      setEdges(builtEdges);
      setLog((l) => [...l, { level: "info", text: `Built ${built.length - 1} step(s).` }]);
    } catch (e: any) {
      setLog((l) => [...l, { level: "error", text: `Plan failed: ${e?.message ?? e}` }]);
    } finally {
      setPlanning(false);
    }
  }

  async function runNode(n: Node) {
    const d = n.data as AgentNodeData;
    if (d.kind === "trigger") return;
    setStatus(n.id, "running");
    try {
      if (d.kind === "research") {
        const res = await fetch("/api/browse", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: d.instruction || input }),
        });
        const data = await res.json();
        const text = (data.text as string) || "(no results)";
        researchRef.current += `\n[${d.label}]\n${text}\n`;
        setResult(n.id, text.slice(0, 400));
        setLog((l) => [...l, { level: "info", text: `${d.label}: ${text.length} chars retrieved` }]);
      } else if (d.kind === "output") {
        const finalOut = researchRef.current
          ? `Based on research:\n${researchRef.current}\n\n${name} output: (see reasoning above)`
          : "Done.";
        setResult(n.id, finalOut.slice(0, 400));
        setOutput(finalOut);
      } else if (d.kind === "youtube") {
        const channel = (d.instruction || input).match(/https?:\/\/\S+/)?.[0] || d.instruction || input;
        const res = await fetch("/api/youtube-email", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ channel }),
        });
        const data = await res.json();
        const r0 = data.results?.[0];
        const found = r0?.emails?.length ? r0.emails.join(", ") : r0?.email;
        setResult(n.id, found || "(no email found)");
        setLog((l) => [...l, { level: "info", text: `${d.label}: ${found || "no email"}` }]);
        researchRef.current += `\n[${d.label}] ${found || "no email"}\n`;
      } else {
        const ctx = researchRef.current ? `\n\nWeb research:\n${researchRef.current}` : "";
        const res = await fetch("/api/agents/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            slug,
            message: `${d.instruction || d.label}${ctx}`,
            persona,
          }),
        });
        const data = await res.json();
        const text = data.response || data.message || "(no response)";
        setResult(n.id, text.slice(0, 400));
        setLog((l) => [...l, { level: "info", text: `${d.label}: ${text.slice(0, 80)}...` }]);
      }
      setStatus(n.id, "done");
    } catch (e: any) {
      setStatus(n.id, "error");
      setLog((l) => [...l, { level: "error", text: `${d.label}: ${e?.message ?? e}` }]);
    }
  }

  async function run() {
    if (running) return;
    setRunning(true);
    setOutput("");
    researchRef.current = "";
    setLog((l) => [...l, { level: "info", text: "Running workflow" }]);
    const order = [...nodes];
    for (const n of order) {
      await runNode(n);
    }
    setRunning(false);
    setLog((l) => [...l, { level: "success", text: "Workflow finished." }]);
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-rule px-4 py-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && buildGraph()}
          placeholder={`Describe what you want ${name} to do...`}
          className="min-w-[260px] flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <ShimmerButton onClick={buildGraph} disabled={planning || !input.trim()}>
          {planning ? "Building" : "Build graph"}
        </ShimmerButton>
        <button
          onClick={run}
          disabled={running}
          className="rounded-md border border-rule px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
        >
          {running ? "Running" : "Run"}
        </button>
        <button
          onClick={defaultGraph}
          className="rounded-md border border-rule px-3 py-2 text-sm hover:bg-muted"
        >
          Reset
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="min-h-[520px] flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>
        <div className="w-72 shrink-0 overflow-auto border-l border-rule bg-card/40 p-3 text-xs">
          <p className="mb-2 font-semibold text-ink-strong">Execution log</p>
          {log.length === 0 ? (
            <p className="text-ink-muted">
              Type a task, hit <b>Build graph</b>, then <b>Run</b>. {name} will research
              the web (headless) and reason with DeepSeek.
            </p>
          ) : (
            <div className="space-y-1">
              {log.map((e, i) => {
                const Icon = LOG_ICON[e.level];
                return (
                  <p
                    key={i}
                    className={cn(
                      "flex items-center gap-1.5",
                      e.level === "error" ? "text-destructive" : "text-ink-muted",
                    )}
                  >
                    {Icon && <Icon className="size-3 shrink-0" />}
                    <span>{e.text}</span>
                  </p>
                );
              })}
            </div>
          )}
          {output && (
            <div className="mt-3 rounded border border-emerald-400/40 bg-emerald-400/5 p-2 text-emerald-200">
              <p className="mb-1 font-semibold">Output</p>
              <p className="whitespace-pre-wrap">{output.slice(0, 1200)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
