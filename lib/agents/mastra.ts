import "server-only";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { getAgentPrompt } from "@/lib/agents/roster";
import { searchVector } from "@/lib/retrieval/vector-index";
import { runBrowseTask } from "@/lib/browse/agent";
import { createWorkingMemory, getWorkingMemory } from "@/lib/memory/working-memory";
import { mem0Remember, mem0Recall, mem0Enabled } from "@/lib/memory/mem0";
import { tavilySearch } from "@/lib/search/tavily";
import { listComposioConnections } from "@/lib/integrations/composio";
import { NVIDIA_DEFAULT_MODEL } from "@/lib/llm/gateway";

// DeepSeek and NVIDIA's chat APIs are both OpenAI-compatible, so we point the
// AI-SDK OpenAI provider at whichever is configured. This gives Mastra a
// working tool-calling model without a separate provider plugin per backend.
// DeepSeek preferred when its key is set (matches lib/llm/gateway.ts's own
// provider order for the multi-agent workflows), NVIDIA otherwise.
function getModel() {
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey) {
    const provider = createOpenAI({ baseURL: "https://api.deepseek.com/v1", apiKey: deepseekKey });
    return provider(process.env.DEEPSEEK_MODEL || "deepseek-chat");
  }
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("No agent model configured: set DEEPSEEK_API_KEY or NVIDIA_API_KEY");
  const provider = createOpenAI({
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey,
  });
  return provider(process.env.NVIDIA_MODEL || NVIDIA_DEFAULT_MODEL);
}

export type MastraAgentResult = {
  ok: boolean;
  answer: string;
  agentName: string;
  toolCalls?: string[];
  error?: string;
};

export async function runMastraAgent(opts: {
  slug: string;
  message: string;
  history?: Array<{ role: string; content: string }>;
  userEmail: string;
}): Promise<MastraAgentResult> {
  const persona = getAgentPrompt(opts.slug);
  if (!persona) return { ok: false, answer: "", agentName: opts.slug, error: "Unknown agent" };

  const userEmail = opts.userEmail;

  const retrieveTool = createTool({
    id: "retrieve",
    description:
      "Search the workspace knowledge base, documents, notes, terminal history, and useful links. Use this to ground answers in stored data.",
    inputSchema: z.object({ query: z.string().describe("search query") }),
    execute: async ({ query }) => {
      const hits = await searchVector(query, {
        collections: ["knowledge", "documents", "notes", "terminal", "links"],
        limit: 6,
      }).catch(() => []);
      return hits
        .map((h) => `[${h.collection}] ${h.text}`)
        .join("\n---\n");
    },
  });

  const browseTool = createTool({
    id: "browse",
    description: "Open a web page with a Playwright-driven browser agent and extract an answer. Use for live web data.",
    inputSchema: z.object({
      task: z.string().describe("what to find or do on the web"),
      startUrl: z.string().optional().describe("optional starting URL"),
    }),
    execute: async ({ task, startUrl }) => {
      const res = await runBrowseTask({ task, startUrl, userEmail }).catch(() => ({
        ok: false,
        result: "",
        steps: [] as any[],
        error: "browse failed",
      }));
      return res.ok ? res.result : `browse error: ${res.error}`;
    },
  });

  const rememberTool = createTool({
    id: "remember",
    description: "Save a fact to the user's working memory for later recall within this session lifespan.",
    inputSchema: z.object({
      content: z.string().describe("the fact to remember"),
      source: z.string().optional(),
    }),
    execute: async ({ content, source }) => {
      // Primary: managed Mem0 layer when configured.
      if (mem0Enabled()) await mem0Remember(userEmail, content).catch(() => {});
      const res = await createWorkingMemory({
        user_email: userEmail,
        content,
        source: source || "agent",
      }).catch(() => ({ success: false, error: "failed" }));
      return res.success ? "saved" : `failed: ${res.error}`;
    },
  });

  const recallTool = createTool({
    id: "recall",
    description: "Recall previously saved working-memory facts for this user.",
    inputSchema: z.object({}),
    execute: async () => {
      if (mem0Enabled()) {
        const mem0res = await mem0Recall(userEmail, "relevant facts").catch(() => "");
        if (mem0res) return mem0res;
      }
      const entries = await getWorkingMemory(userEmail).catch(() => []);
      return entries.map((e: any) => `- ${e.content}`).join("\n") || "(no memory)";
    },
  });

  const webSearchTool = createTool({
    id: "web_search",
    description:
      "Search the live web with Tavily for current facts, news, prices, or anything not in the knowledge base. Use this whenever fresh information is needed.",
    inputSchema: z.object({ query: z.string().describe("the search query") }),
    execute: async ({ query }) => {
      const results = await tavilySearch(query, { maxResults: 5 }).catch(() => []);
      if (!results.length) return "No web results found.";
      return results
        .map((r) => `[${r.title}] ${r.url}\n${r.content}`)
        .join("\n---\n");
    },
  });

  // Connected external tools (Composio / integration section). Read-only list so
  // the agent knows what actions it can pull from the connected integrations.
  const connections = await listComposioConnections().catch(() => []);
  const integrationsTool = createTool({
    id: "integrations",
    description:
      "List the external tools and integrations connected to this workspace (e.g. Composio apps). Use to discover what external actions are available before reasoning about a task.",
    inputSchema: z.object({}),
    execute: async () => {
      if (!connections.length) return "No external integrations are connected.";
      return connections
        .map((c: { app: string; status: string }) => `- ${c.app} (${c.status})`)
        .join("\n");
    },
  });

  const agent = new Agent({
    name: persona.name,
    instructions: persona.prompt,
    model: getModel(),
    tools: {
      web_search: webSearchTool,
      retrieve: retrieveTool,
      browse: browseTool,
      integrations: integrationsTool,
      remember: rememberTool,
      recall: recallTool,
    },
  });

  const messages = [
    ...(opts.history ?? [])
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-20)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: opts.message },
  ];

  try {
    const result = await agent.generate(messages);
    return {
      ok: true,
      answer: result.text ?? "",
      agentName: persona.name,
      toolCalls:
        (result as any).toolCalls?.map((t: any) => t.payload?.toolName ?? t.toolName) ?? [],
    };
  } catch (err) {
    return {
      ok: false,
      answer: "",
      agentName: persona.name,
      error: err instanceof Error ? err.message : "agent run failed",
    };
  }
}
