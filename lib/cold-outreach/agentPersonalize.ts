import "server-only";
import { getAgentPrompt } from "@/lib/agents/roster";
import { chatCompletion } from "@/lib/llm/gateway";
import { buildLeadResearchQuery, searchTavily } from "./tavily";
import { renderPersonalized } from "./spintax";

export type PersonalizeLead = {
  email: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  company?: string;
  personalizedInfo?: string;
};

export type PersonalizeRequest = {
  template: string;
  subject?: string;
  placeholders: string[];
  leads: PersonalizeLead[];
  agentSlug?: string;
  useWebSearch?: boolean;
  onProgress?: (done: number, total: number) => void;
};

export type PersonalizedRow = {
  email: string;
  variables: Record<string, string>;
  body: string;
  subject: string;
  researchSnippets: string[];
  error?: string;
};

const DEFAULT_AGENT_SLUG = "cold-outreach";

function buildSystemPrompt(agentName: string, agentPrompt: string, placeholders: string[]): string {
  return `${agentPrompt}

You are personalizing a cold outreach email for a specific lead. The email template uses GoPhish dynamic variables wrapped in double braces, e.g. {{.FirstName}}.

Your task:
1. Review the lead information and any research snippets provided.
2. Identify the placeholder values the template needs: ${placeholders.map((p) => `{{.${p}}}`).join(", ")}.
3. For each placeholder, write a natural, conversational 1-4 line personalized snippet that fits naturally into the email and references the lead's real context (company, role, recent work).
4. Return a JSON object with one key per placeholder name (e.g. {"FirstName": "Sarah", "Company": "Acme"}).

Rules:
- Keep each placeholder value to 1-4 lines of plain text (no HTML, no markdown).
- Be specific and grounded in the research snippets. Do not invent facts.
- If a field is unknown, return an empty string for that key.
- Output strictly valid JSON. No prose, no code fences, no explanation.
- Do not include any spam trigger words (no "guaranteed", "act now", "click here", "100% free", "risk-free", etc.). Keep it conversational and high-deliverability.
- Personalize only the specified placeholders. Do not modify the rest of the template.`;
}

function buildUserPrompt(lead: PersonalizeLead, researchSnippets: string[], template: string, subject?: string): string {
  return `LEAD INFORMATION:
Name: ${[lead.firstName, lead.lastName].filter(Boolean).join(" ") || "(unknown)"}
Email: ${lead.email}
Company: ${lead.company || "(unknown)"}
Position: ${lead.position || "(unknown)"}

${
  lead.personalizedInfo
    ? `PERSONALIZED INFORMATION (already researched for this person — weave these true facts into the email naturally):
${lead.personalizedInfo}
`
    : ""
}${researchSnippets.length > 0 ? `RESEARCH SNIPPETS (from web search):
${researchSnippets.map((s, i) => `[${i + 1}] ${s}`).join("\n\n")}` : "No research snippets available."}

${subject ? `EMAIL SUBJECT TEMPLATE: ${subject}\n` : ""}EMAIL BODY TEMPLATE:
${template}

Return the JSON object with personalized values for the placeholders.`;
}

function extractJsonObject(text: string): Record<string, string> | null {
  if (!text) return null;
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        out[k] = typeof v === "string" ? v : v == null ? "" : String(v);
      }
      return out;
    }
  } catch {
    const fenceMatch = trimmed.match(/\{[\s\S]*\}/);
    if (fenceMatch) {
      try {
        const parsed = JSON.parse(fenceMatch[0]);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const out: Record<string, string> = {};
          for (const [k, v] of Object.entries(parsed)) {
            out[k] = typeof v === "string" ? v : v == null ? "" : String(v);
          }
          return out;
        }
      } catch {
        return null;
      }
    }
  }
  return null;
}

function buildPersonalizedVars(lead: PersonalizeLead, placeholders: string[], aiVars: Record<string, string>): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const key of placeholders) {
    const aiValue = (aiVars[key] ?? "").trim();
    switch (key) {
      case "FirstName":
        vars.FirstName = lead.firstName || aiValue || "";
        break;
      case "LastName":
        vars.LastName = lead.lastName || aiValue || "";
        break;
      case "Email":
        vars.Email = lead.email;
        break;
      case "Position":
        vars.Position = lead.position || aiValue || "";
        break;
      case "Company":
        vars.Company = lead.company || aiValue || "";
        break;
      case "PersonalizedInfo":
        vars.PersonalizedInfo = lead.personalizedInfo || aiValue || "";
        break;
      default:
        vars[key] = aiValue;
    }
  }
  return vars;
}

export async function personalizeLeads(req: PersonalizeRequest): Promise<PersonalizedRow[]> {
  const agentSlug = req.agentSlug ?? DEFAULT_AGENT_SLUG;
  const agent = getAgentPrompt(agentSlug);
  if (!agent) {
    throw new Error(`Agent "${agentSlug}" not found in roster`);
  }
  const useSearch = req.useWebSearch ?? true;
  const placeholders = req.placeholders.length > 0 ? req.placeholders : ["FirstName", "Company"];
  const systemPrompt = buildSystemPrompt(agent.name, agent.prompt, placeholders);

  const out: PersonalizedRow[] = [];
  for (let i = 0; i < req.leads.length; i++) {
    const lead = req.leads[i];
    const row: PersonalizedRow = {
      email: lead.email,
      variables: {},
      body: "",
      subject: req.subject ?? "",
      researchSnippets: [],
    };

    try {
      let snippets: string[] = [];
      if (useSearch) {
        try {
          const query = buildLeadResearchQuery(lead);
          if (query) {
            const tavily = await searchTavily(query, { maxResults: 4, searchDepth: "basic" });
            snippets = tavily.results
              .map((r) => `${r.title} — ${r.content}`)
              .slice(0, 4);
            row.researchSnippets = snippets;
          }
        } catch {
          snippets = [];
        }
      }

      const userPrompt = buildUserPrompt(lead, snippets, req.template, req.subject);
      const response = await chatCompletion(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        { maxTokens: 800, temperature: 0.4 }
      );

      const aiVars = extractJsonObject(response) ?? {};
      const vars = buildPersonalizedVars(lead, placeholders, aiVars);
      row.variables = vars;
      row.body = renderPersonalized(req.template, vars);
      row.subject = req.subject ? renderPersonalized(req.subject, vars) : "";
    } catch (err) {
      row.error = err instanceof Error ? err.message : "Personalization failed";
      row.body = req.template;
    }

    out.push(row);
    if (req.onProgress) {
      await Promise.resolve(req.onProgress(i + 1, req.leads.length));
    }
  }
  return out;
}
