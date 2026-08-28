import { Mastra } from '@mastra/core/mastra';
import { Agent } from '@mastra/core/agent';
import { createOpenAI } from '@ai-sdk/openai';
import { loadPersonas } from './personas';
import { webSearchTool, retrieveTool, browseTool, rememberTool, recallTool } from './tools';
import { getComposioSessionTools, getIntegrationsListTool } from './composio-tools';

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

// Mastra keys its agent registry by each Agent's own `name` property, not by
// the object key here — so `name` must be the slug (what /api/agents/:id/
// generate is addressed by, matching what the dashboard sends). The
// human-friendly display name from the persona's frontmatter isn't needed
// here; the dashboard already gets it from the main app's own roster.ts.
const agents = Object.fromEntries(
  personas.map((p) => [
    p.slug,
    new Agent({
      name: p.slug,
      instructions: p.instructions,
      model,
      tools: baseTools,
    }),
  ])
);

export const mastra = new Mastra({ agents });
