import { Mastra } from '@mastra/core/mastra';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { Workflow, createStep, createWorkflow } from '@mastra/core/workflows';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { loadPersonas } from './personas';
import { webSearchTool, retrieveTool, browseTool, rememberTool, recallTool } from './tools';
import { getComposioSessionTools, getIntegrationsListTool } from './composio-tools';
import { createToxicityScorer, createFaithfulnessScorer } from '@mastra/evals/scorers/prebuilt';

// Same DeepSeek-then-NVIDIA resolution as the main app's lib/agents/mastra.ts
// getModel(), so persona behavior doesn't change by moving where it runs.
function getModel() {
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey) {
    const provider = createOpenAI({ baseURL: 'https://api.deepseek.com/v1', apiKey: deepseekKey });
    return provider(process.env.DEEPSEEK_MODEL || 'deepseek-chat');
  }
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error('No agent model configured: set DEEPSEEK_API_KEY or NVIDIA_API_KEY');
  const provider = createOpenAI({
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKey,
  });
  return provider(process.env.NVIDIA_DEFAULT_MODEL || 'meta/llama-3.1-70b-instruct');
}

// Fetched once at startup, not per-request: connected-integration tools
// rarely change, and Mastra agents here are registered statically. Connecting
// a new app in Integrations picks up here after `pm2 restart mastra-agents`.
const composioTools = await getComposioSessionTools();
const integrationsTool = await getIntegrationsListTool();

const baseTools = {
  web_search: webSearchTool,
  retrieve: retrieveTool,
  browse: browseTool,
  integrations: integrationsTool,
  remember: rememberTool,
  recall: recallTool,
  ...composioTools,
};

const personas = loadPersonas();
const model = getModel();

// Conversation + working memory shared by every agent (no embedder required:
// semantic recall stays off, so no OpenAI key is needed for memory to work).
const memory = new Memory();

// Registered on every agent so the playground's Evaluations tab is live.
// These LLM-judge scorers run on demand against agent output.
const evals = {
  toxicity: createToxicityScorer({ model }),
  faithfulness: createFaithfulnessScorer({ model }),
};

// A dedicated research agent used by the deep-research workflow and also
// exposed in the playground like the other personas.
const researchAgent = new Agent({
  name: 'research-synthesizer',
  instructions:
    'You are a meticulous research synthesizer. Given raw web sources and notes, ' +
    'produce a concise, well-structured brief with the key findings, any caveats, ' +
    'and inline citations to the provided source URLs. Never invent sources.',
  model,
  tools: baseTools,
  memory,
  evals,
});

// Mastra keys its agent registry by each Agent's own `name` property, not by
// the object key here — so `name` must be the slug (what /api/agents/:id/
// generate is addressed by, matching what the dashboard sends). The
// human-friendly display name from the persona's frontmatter isn't needed
// here; the dashboard already gets it from the main app's own roster.ts.
const personaAgents = Object.fromEntries(
  personas.map((p) => [
    p.slug,
    new Agent({
      name: p.slug,
      instructions: p.instructions,
      model,
      tools: baseTools,
      memory,
      evals,
    }),
  ])
);

const agents = {
  ...personaAgents,
  'research-synthesizer': researchAgent,
};

// Deep-research workflow: gather sources with web_search, then synthesize a
// sourced brief with the research agent. Runnable from the playground's
// Workflows tab.
const researchStep = createStep({
  id: 'research',
  inputSchema: z.object({ topic: z.string() }),
  outputSchema: z.object({
    topic: z.string(),
    findings: z.string(),
    sources: z.array(z.string()),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    const raw = (await webSearchTool.execute({
      context: { query: inputData.topic, maxResults: 5 },
      runtimeContext,
    })) as any;
    const items = raw?.results && Array.isArray(raw.results) ? raw.results : Array.isArray(raw) ? raw : [];
    const findings =
      items
        .map((r: any) => `- ${r.title ?? ''} (${r.url ?? ''})\n  ${r.content ?? r.snippet ?? ''}`)
        .join('\n') || 'No results found.';
    const sources = items.map((r: any) => r.url).filter(Boolean);
    return { topic: inputData.topic, findings, sources };
  },
});

const summarizeStep = createStep({
  id: 'summarize',
  inputSchema: z.object({ topic: z.string(), findings: z.string(), sources: z.array(z.string()) }),
  outputSchema: z.object({ brief: z.string(), sources: z.array(z.string()) }),
  execute: async ({ inputData }) => {
    const result = await researchAgent.generate(
      `Produce a concise, sourced research brief on: ${inputData.topic}\n\n` +
        `Sources and notes:\n${inputData.findings}`
    );
    return { brief: result.text, sources: inputData.sources };
  },
});

const deepResearch = createWorkflow({
  id: 'deep-research',
  inputSchema: z.object({ topic: z.string() }),
  outputSchema: z.object({ brief: z.string(), sources: z.array(z.string()) }),
})
  .then(researchStep)
  .then(summarizeStep)
  .commit();

export const mastra = new Mastra({
  agents,
  workflows: { deepResearch },
  memory,
});
