import type { MastraCatalogAgent } from "@/lib/agents/mastra-catalog";
import type { RosterAgent } from "@/lib/agents/roster";
import {
  Bot,
  Video,
  Mail,
  Target,
  Globe,
  Search,
  BookOpen,
  PenLine,
  Code2,
  Lightbulb,
  BarChart3,
  Share2,
  Calendar,
  Image,
  Wallet,
  LifeBuoy,
  Users,
  Scale,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { ReactElement } from "react";

const ICON_RULES: [RegExp, LucideIcon][] = [
  [/youtube/, Video],
  [/(email|mail|outreach|newsletter)/, Mail],
  [/(lead|prospect|outbound|sales|cold)/, Target],
  [/(crawl|scrape|browser|browse|serp|web)/, Globe],
  [/(research|search|analy|investigat|study)/, Search],
  [/(knowledge|wiki|docs?|library|encycl)/, BookOpen],
  [/(write|draft|content|blog|copy|editor)/, PenLine],
  [/(code|build|dev|script|engineer|software)/, Code2],
  [/(brainstorm|creative|idea|design|brand)/, Lightbulb],
  [/(data|analytics|metric|report|dashboard)/, BarChart3],
  [/(social|twitter|x\.com|linkedin|instagram)/, Share2],
  [/(calendar|schedule|meet|book)/, Calendar],
  [/(image|video|media|visual|photo)/, Image],
  [/(finance|account|invoice|billing|pay)/, Wallet],
  [/(support|help|ticket|service)/, LifeBuoy],
  [/(hr|recruit|hire|talent)/, Users],
  [/(legal|contract|compliance|policy)/, Scale],
  [/(market|seo|growth|ads?)/, TrendingUp],
];

/** Pick a distinct icon per agent from its role (tools + description + name). */
export function agentIcon(agent: NormalizedAgent, className = "size-5"): ReactElement {
  const hay = `${agent.slug} ${agent.name} ${agent.description} ${(agent.tools ?? []).join(" ")}`.toLowerCase();
  for (const [re, Icon] of ICON_RULES) {
    if (re.test(hay)) return <Icon className={className} />;
  }
  return <Bot className={className} />;
}

export type NormalizedAgent = {
  slug: string;
  name: string;
  framework: "Mastra" | "Claude";
  description: string;
  iconSlug?: string;
  emoji?: string | null;
  color?: string | null;
  model?: string;
  tools?: string[];
  instructions?: string;
};

export function normalizeMastra(a: MastraCatalogAgent): NormalizedAgent {
  return {
    slug: a.slug,
    name: a.name,
    framework: "Mastra",
    description: a.description || "",
    emoji: a.emoji,
    color: a.color,
    model: a.modelId || undefined,
    tools: a.tools ?? [],
    instructions: a.instructions,
  };
}

export function normalizeClaude(a: RosterAgent): NormalizedAgent {
  return {
    slug: a.slug,
    name: a.name,
    framework: "Claude",
    description: a.description,
    iconSlug: a.slug,
    color: a.color,
  };
}

function pretty(t: string): string {
  return t.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

const RESEARCH_RE =
  /(search|web|browser|browse|tavily|crawl|scrape|fetch|wiki|knowledge|read|arxiv|serp|google|perplexity)/i;
const ACTION_RE =
  /(send|post|email|write|create|deploy|publish|upload|update|sync|slack|notion|sheet|doc|calendar|tweet|message|sms|github|composio)/i;

export type PipelineStep = {
  key: "trigger" | "research" | "reason" | "seek";
  label: string;
  text: string;
};

/**
 * Builds the four-stage workflow (Trigger → Research → Reason → Seek) from the
 * agent's real data: tools it actually has, the model it runs, and its
 * description. No invented copy — empty where the agent has nothing to show.
 */
export function derivePipeline(a: NormalizedAgent): PipelineStep[] {
  const desc = (a.description || "").trim();
  const tools = a.tools ?? [];
  const researchTools = tools.filter((t) => RESEARCH_RE.test(t));
  const actionTools = tools.filter((t) => ACTION_RE.test(t));

  const trigger = desc
    ? `Triggered by tasks such as: ${truncate(desc, 90)}`
    : `Triggered from the ${a.framework} Agents dashboard.`;
  const research = researchTools.length
    ? `Researches using ${researchTools.slice(0, 5).map(pretty).join(", ")}.`
    : "No external research tools connected.";
  const reason = a.model ? `Reasons with the ${a.model} model.` : "Reasons with its language model.";
  const seek = actionTools.length
    ? `Acts through ${actionTools.slice(0, 5).map(pretty).join(", ")}.`
    : "Returns the result to the caller.";

  return [
    { key: "trigger", label: "Trigger", text: trigger },
    { key: "research", label: "Research", text: research },
    { key: "reason", label: "Reason", text: reason },
    { key: "seek", label: "Seek", text: seek },
  ];
}
