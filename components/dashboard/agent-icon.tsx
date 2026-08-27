"use client";

import {
  Telescope,
  Globe,
  Database,
  Users,
  TrendingUp,
  Server,
  Workflow,
  Lightbulb,
  Bot,
  type LucideIcon,
} from "lucide-react";
import divisionMap from "@/lib/agents/agent-divisions.json";

const DIVISION_ICON: Record<string, LucideIcon> = {
  Research: Telescope,
  Browse: Globe,
  Knowledge: Database,
  "Lead Generation": Users,
  Growth: TrendingUp,
  Infrastructure: Server,
  Automation: Workflow,
  Product: Lightbulb,
};

const FALLBACK: LucideIcon = Bot;

const SLUG_DIVISION = new Map(
  (divisionMap as { slug: string; division: string; team: string | null }[]).map((d) => [
    d.slug,
    d.division,
  ]),
);

export function AgentIcon({ slug, className }: { slug: string; className?: string }) {
  const division = SLUG_DIVISION.get(slug) ?? "specialized";
  const Icon = DIVISION_ICON[division] ?? FALLBACK;
  return <Icon className={className} aria-hidden />;
}
