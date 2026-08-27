import "server-only";

import { stagehandEnabled } from "@/lib/browse/stagehand";
import { browserUseEnabled } from "@/lib/browse/browseruse";
import { steelEnabled } from "@/lib/browse/steel";
import { mem0Enabled } from "@/lib/memory/mem0";
import { langfuseEnabled } from "@/lib/observability/langfuse";
import { infisicalEnabled } from "@/lib/vault/infisical";
import { composioEnabled } from "@/lib/integrations/composio";
import { novuEnabled } from "@/lib/notifications/novu";
import { windmillEnabled } from "@/lib/windmill/client";
import { isCaptchaSolvingEnabled } from "@/lib/integrations/captcha";

export type IntegrationAction =
  | "temporal"
  | "windmill"
  | "composio"
  | "novu"
  | "mem0"
  | "link"
  | "none";

export type IntegrationGroup = "Agent surfaces" | "Connected services";

export type IntegrationStatus = {
  id: string;
  name: string;
  repo: string;
  description: string;
  group: IntegrationGroup;
  enabled: boolean;
  pageHref?: string;
  action: IntegrationAction;
};

export function getIntegrationStatuses(): IntegrationStatus[] {
  const captchaOn = isCaptchaSolvingEnabled() && Boolean(process.env.TWOCAPTCHA_API_KEY);
  const gatewayOn = Boolean(process.env.NVIDIA_API_KEY || process.env.OPENROUTER_API_KEY);
  const litellmOn = Boolean(process.env.LITELLM_BASE_URL && process.env.LITELLM_API_KEY);
  const temporalOn = Boolean(process.env.TEMPORAL_ADDRESS);

  return [
    {
      id: "browse",
      name: "Browse",
      repo: "Playwright + Stagehand + browser-use + Steel",
      description:
        "LLM-stepped web agent. Active backends: Stagehand, browser-use, Steel (falls back to local Playwright).",
      group: "Agent surfaces",
      enabled: true,
      pageHref: "/browse",
      action: "link",
    },
    {
      id: "memory",
      name: "Memory",
      repo: "working_memory + Mem0",
      description: "Session-lifespan memory with an optional managed Mem0 layer.",
      group: "Agent surfaces",
      enabled: true,
      pageHref: "/memory",
      action: "link",
    },
    {
      id: "agents",
      name: "Agents",
      repo: "Mastra",
      description: "Mastra agent with retrieve/browse/remember/recall tools over NVIDIA.",
      group: "Agent surfaces",
      enabled: true,
      pageHref: "/agents",
      action: "link",
    },
    {
      id: "automations",
      name: "Automations",
      repo: "task_runs",
      description: "Background task runs and orchestration (optional Windmill).",
      group: "Agent surfaces",
      enabled: true,
      pageHref: "/automations",
      action: "link",
    },
    {
      id: "leads",
      name: "Lead Harvest",
      repo: "YouTube + 2Captcha",
      description: "Drives Browse to gather channel contact emails into leads.",
      group: "Agent surfaces",
      enabled: true,
      pageHref: "/leads",
      action: "link",
    },
    {
      id: "eval",
      name: "Eval",
      repo: "Ragas-style",
      description: "Faithfulness / answer & context relevancy LLM-as-judge evaluator.",
      group: "Agent surfaces",
      enabled: true,
      pageHref: "/eval",
      action: "link",
    },
    {
      id: "composio",
      name: "Composio",
      repo: "composioHQ/composio",
      description: "Tool/action marketplace connections.",
      group: "Connected services",
      enabled: composioEnabled(),
      action: "composio",
    },
    {
      id: "novu",
      name: "Novu",
      repo: "novuhq/novu",
      description: "Notification delivery alongside Appwrite notifications.",
      group: "Connected services",
      enabled: novuEnabled(),
      action: "novu",
    },
    {
      id: "mem0",
      name: "Mem0",
      repo: "mem0ai/mem0",
      description: "Managed memory layer hooked into Mastra remember/recall.",
      group: "Connected services",
      enabled: mem0Enabled(),
      action: "mem0",
    },
    {
      id: "langfuse",
      name: "Langfuse",
      repo: "langfuse/langfuse",
      description: "LLM observability; traces each gateway completion.",
      group: "Connected services",
      enabled: langfuseEnabled(),
      action: "none",
    },
    {
      id: "infisical",
      name: "Infisical",
      repo: "Infisical/infisical",
      description: "Secrets management; loads env into the process at gateway boot.",
      group: "Connected services",
      enabled: infisicalEnabled(),
      action: "none",
    },
    {
      id: "steel",
      name: "Steel",
      repo: "steel-dev/steel-browser",
      description: "Managed browser backend for the Browse agent.",
      group: "Connected services",
      enabled: steelEnabled(),
      action: "none",
    },
    {
      id: "windmill",
      name: "Windmill",
      repo: "windmill-labs/windmill",
      description: "Self-hosted orchestration over REST.", group: "Connected services",
      enabled: windmillEnabled(),
      action: "windmill",
    },
    {
      id: "temporal",
      name: "Temporal",
      repo: "temporalio/temporal",
      description: "Durable workflow orchestration for agent tasks.",
      group: "Connected services",
      enabled: temporalOn,
      action: "temporal",
    },
    {
      id: "litellm",
      name: "LiteLLM",
      repo: "BerriAI/litellm",
      description: "LLM routing/key-management layer (preferred provider when set).",
      group: "Connected services",
      enabled: litellmOn,
      action: "none",
    },
    {
      id: "gateway",
      name: "LLM Gateway",
      repo: "NVIDIA + OpenRouter",
      description: "Unified NVIDIA-primary gateway with OpenRouter fallback.",
      group: "Connected services",
      enabled: gatewayOn,
      action: "none",
    },
    {
      id: "stagehand",
      name: "Stagehand",
      repo: "browserbase/stagehand",
      description: "Browserbase TS SDK powering the Browse agent via the gateway LLM.",
      group: "Connected services",
      enabled: stagehandEnabled(),
      action: "none",
    },
    {
      id: "browseruse",
      name: "browser-use",
      repo: "webllm/browser-use (TS port)",
      description: "TS port of browser-use driving the Browse agent.",
      group: "Connected services",
      enabled: browserUseEnabled(),
      action: "none",
    },
    {
      id: "captcha",
      name: "Captcha Solver",
      repo: "2Captcha",
      description: "CAPTCHA solving for the Browse / lead pipeline.",
      group: "Connected services",
      enabled: captchaOn,
      action: "none",
    },
  ];
}

export const INTEGRATION_GROUPS: IntegrationGroup[] = ["Agent surfaces", "Connected services"];
