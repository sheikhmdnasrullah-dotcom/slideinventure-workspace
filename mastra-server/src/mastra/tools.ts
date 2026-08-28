import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { callInternalTool } from "./internal-client";

// web_search: self-contained (Tavily's own API), same as lib/search/tavily.ts.
export const webSearchTool = createTool({
  id: "web_search",
  description:
    "Search the live web with Tavily for current facts, news, prices, or anything not in the knowledge base. Use this whenever fresh information is needed.",
  inputSchema: z.object({ query: z.string().describe("the search query") }),
  execute: async ({ query }) => {
    const key = process.env.TAVILY_API_KEY;
    if (!key) return "Web search is not configured.";
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: key, query, max_results: 5 }),
      });
      if (!res.ok) return "No web results found.";
      const json = await res.json();
      const results = (json.results ?? []) as Array<{ title: string; url: string; content: string }>;
      if (!results.length) return "No web results found.";
      return results.map((r) => `[${r.title}] ${r.url}\n${r.content}`).join("\n---\n");
    } catch {
      return "No web results found.";
    }
  },
});

// retrieve/remember/recall/browse: proxy to the main app (needs its Appwrite
// data / browser-automation infra) via /api/internal/agent-tools. `userEmail`
// travels per-call via requestContext (agents.slideinventure.com/api/agents/
// :id/generate accepts `{..., requestContext: {userEmail}}` in its body) since
// these agents are registered once at server start, not rebuilt per request.
export const retrieveTool = createTool({
  id: "retrieve",
  description:
    "Search the workspace knowledge base, documents, notes, terminal history, and useful links. Use this to ground answers in stored data.",
  inputSchema: z.object({ query: z.string().describe("search query") }),
  execute: async ({ query }) => {
    try {
      const { hits } = await callInternalTool("retrieve", { query });
      if (!hits?.length) return "No results.";
      return hits.map((h: { collection: string; text: string }) => `[${h.collection}] ${h.text}`).join("\n---\n");
    } catch {
      return "Retrieve is unavailable right now.";
    }
  },
});

export const browseTool = createTool({
  id: "browse",
  description: "Open a web page with a browser agent and extract an answer. Use for live web data.",
  inputSchema: z.object({
    task: z.string().describe("what to find or do on the web"),
    startUrl: z.string().optional().describe("optional starting URL"),
  }),
  execute: async ({ task, startUrl }, ctx) => {
    try {
      const userEmail = ctx.requestContext?.get("userEmail" as never) as string | undefined;
      const res = await callInternalTool("browse", { task, startUrl, userEmail });
      return res.ok ? res.result : `browse error: ${res.error}`;
    } catch {
      return "Browse is unavailable right now.";
    }
  },
});

export const rememberTool = createTool({
  id: "remember",
  description: "Save a fact to the user's working memory for later recall within this session lifespan.",
  inputSchema: z.object({ content: z.string().describe("the fact to remember"), source: z.string().optional() }),
  execute: async ({ content, source }, ctx) => {
    try {
      const userEmail = ctx.requestContext?.get("userEmail" as never) as string | undefined;
      if (!userEmail) return "failed: no user context";
      const res = await callInternalTool("remember", { userEmail, content, source });
      return res.ok ? "saved" : `failed: ${res.error}`;
    } catch {
      return "failed: memory unavailable";
    }
  },
});

export const recallTool = createTool({
  id: "recall",
  description: "Recall previously saved working-memory facts for this user.",
  inputSchema: z.object({}),
  execute: async (_input, ctx) => {
    try {
      const userEmail = ctx.requestContext?.get("userEmail" as never) as string | undefined;
      if (!userEmail) return "(no memory)";
      const { text } = await callInternalTool("recall", { userEmail });
      return text || "(no memory)";
    } catch {
      return "(no memory)";
    }
  },
});
