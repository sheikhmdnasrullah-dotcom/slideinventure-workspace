"use client";

import Link from "next/link";
import { Workflow, Sparkles, Mail, ArrowUpRight } from "lucide-react";

export function AgentModesGrid() {
  const modes = [
    {
      id: "agent-canvas",
      title: "Agent Workflow Canvas",
      description: "Visual node-based pipeline builder for chaining multi-agent triggers, reasoning steps, and automation tools.",
      href: "/agent-canvas",
      icon: Workflow,
      color: "#8b5cf6",
      tag: "Automation",
    },
    {
      id: "lead-research-assistant",
      title: "Lead Research Assistant",
      description: "Interactive prospect & company intelligence agent with CSV upload and operational Leads table sync.",
      href: "/leads?assistant=1",
      icon: Sparkles,
      color: "#3b82f6",
      tag: "Intelligence",
    },
    {
      id: "email-crawler",
      title: "Email Crawler",
      description: "Unified multi-agent pipeline — YouTube Extractor, Deep Crawler, Browse Agent, Pattern Verifier, and OSINT Harvester hand off to each other until a verified email is found.",
      href: "/email-crawler",
      icon: Mail,
      color: "#10b981",
      tag: "Growth",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {modes.map((mode) => {
        const Icon = mode.icon;
        return (
          <Link
            key={mode.id}
            href={mode.href}
            className="group relative flex flex-col justify-between rounded-xl border border-rule bg-[var(--surface)] p-4 transition-all duration-200 hover:-translate-y-1 hover:border-primary hover:shadow-md"
          >
            <div>
              <div className="flex items-center justify-between">
                <span
                  className="flex size-11 items-center justify-center rounded-xl transition-transform group-hover:scale-105"
                  style={{
                    background: `color-mix(in oklch, ${mode.color} 14%, transparent)`,
                    color: mode.color,
                  }}
                >
                  <Icon className="size-5" />
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase"
                  style={{
                    background: `color-mix(in oklch, ${mode.color} 10%, transparent)`,
                    color: mode.color,
                  }}
                >
                  {mode.tag}
                </span>
              </div>
              <h3 className="mt-3.5 font-label text-sm font-semibold text-ink-strong group-hover:text-primary transition-colors flex items-center gap-1">
                {mode.title}
                <ArrowUpRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </h3>
              <p className="mt-1.5 text-xs text-ink-muted leading-relaxed line-clamp-2">
                {mode.description}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-rule/60 flex items-center justify-between text-[11px] text-ink-muted">
              <span>Dedicated Agent</span>
              <span className="font-medium text-primary">Open →</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
