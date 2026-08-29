"use client";

import * as React from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type NodeProps,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion } from "framer-motion";
import { ArrowRight, Globe, ShieldCheck, Network, MailCheck, UserPlus, type LucideIcon } from "lucide-react";
import { AGENT_STAGES, type AgentStage } from "@/lib/agui/bus";

export type StageStatus = "idle" | "running" | "done" | "error";

const NODE_META: Record<
  AgentStage,
  { label: string; sub: string; icon: LucideIcon }
> = {
  input: { label: "Input Ingestion", sub: "Prospect link + details", icon: ArrowRight },
  browser: { label: "Browser Navigation", sub: "Headless surf", icon: Globe },
  captcha: { label: "CAPTCHA Solver", sub: "2Captcha bridge", icon: ShieldCheck },
  crawl: { label: "Deep Crawler", sub: "crawl4ai / browser-use", icon: Network },
  reacher: { label: "Reacher Validation", sub: "SMTP verify", icon: MailCheck },
  lead: { label: "Lead Emitted", sub: "Imported to CRM", icon: UserPlus },
};

const STATUS_RING: Record<StageStatus, string> = {
  idle: "border-border",
  running: "border-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.5)]",
  done: "border-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.45)]",
  error: "border-rose-400 shadow-[0_0_18px_rgba(244,63,94,0.45)]",
};

function StageNode({ data }: NodeProps) {
  const stage = data.stage as AgentStage;
  const status = (data.status as StageStatus) ?? "idle";
  const meta = NODE_META[stage];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`w-44 rounded-xl border bg-card/80 p-3 backdrop-blur ${
        STATUS_RING[status]
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-primary" />
      <div className="flex items-center gap-2">
        <meta.icon className="size-4 text-ink-strong" />
        <span className="text-xs font-semibold">{meta.label}</span>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">{meta.sub}</p>
      <span className="mt-2 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {status}
      </span>
      <Handle type="source" position={Position.Right} className="!bg-primary" />
    </motion.div>
  );
}

const nodeTypes = { stage: StageNode };

export function AgentFlowCanvas({
  statuses,
}: {
  statuses: Record<AgentStage, StageStatus>;
}) {
  const nodes: Node[] = React.useMemo(() => {
    const x = 40;
    const gapY = 120;
    return AGENT_STAGES.map((stage, i) => ({
      id: stage,
      type: "stage",
      position: { x, y: i * gapY },
      data: { stage, status: statuses[stage] },
    }));
  }, [statuses]);

  const edges: Edge[] = React.useMemo(() => {
    return AGENT_STAGES.slice(0, -1).map((stage, i) => ({
      id: `${stage}-${AGENT_STAGES[i + 1]}`,
      source: stage,
      target: AGENT_STAGES[i + 1],
      animated: statuses[stage] === "done" || statuses[stage] === "running",
      style: { stroke: "var(--primary)", strokeWidth: 2 },
    }));
  }, [statuses]);

  return (
    <div className="h-[560px] w-full rounded-xl border bg-background/40">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
      >
        <Background gap={18} color="var(--border)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
