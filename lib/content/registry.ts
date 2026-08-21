/**
 * Adaptive Content System — Registry + Schemas
 *
 * The brief's central conceptual feature: artifacts arrive in arbitrary formats
 * (CSV, PDF, image, research, etc.), get classified, structure is extracted,
 * and an existing UI schema renders them. No LLM codegen — the renderer is
 * picked from a fixed registry keyed by `content_type`.
 *
 * Extend this file when a new content type lands. The classifier writes the
 * enum value; the renderer reads it. Single source of truth.
 */

import { z } from "zod";

/**
 * The exhaustive enum of content types the system can render. Keep in sync
 * with the classifier (lib/content/classifier.ts) and the renderer registry
 * (lib/content/renderers.tsx).
 */
export const ContentType = {
  // Prose / knowledge
  TEXT: "TEXT",
  DOCUMENT: "DOCUMENT",
  RESEARCH: "RESEARCH",
  CLAUDE_SESSION: "CLAUDE_SESSION",
  AGENT_EXECUTION: "AGENT_EXECUTION",
  SOP: "SOP",
  DECISION: "DECISION",
  INSIGHT: "INSIGHT",
  SOURCE: "SOURCE",

  // Structured data
  CSV: "CSV",
  SPREADSHEET: "SPREADSHEET",
  LEAD: "LEAD",
  COMPANY: "COMPANY",
  PERSON: "PERSON",
  CLIENT: "CLIENT",
  CAMPAIGN: "CAMPAIGN",
  EMAIL: "EMAIL",
  TASK: "TASK",
  PROJECT: "PROJECT",
  MEETING: "MEETING",

  // Binary / external
  PDF: "PDF",
  IMAGE: "IMAGE",
  LINK: "LINK",
  WEB_RESEARCH: "WEB_RESEARCH",

  // Fallback
  UNKNOWN: "UNKNOWN",
} as const;

export type ContentType = (typeof ContentType)[keyof typeof ContentType];
export const CONTENT_TYPE_KEYS = Object.keys(ContentType) as ContentType[];

/**
 * Base fields every content item carries, regardless of type.
 */
const BaseContentSchema = z.object({
  content_type: z.enum(CONTENT_TYPE_KEYS),
  title: z.string().min(1),
  source: z.string().url().or(z.string().min(1)).optional(),
  author: z.string().optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

/**
 * Per-type schemas. The classifier emits the full object matching the
 * schema for its type; the registry validates with Zod before persisting.
 * Any validation failure → content_type = UNKNOWN → generic DocumentView.
 */

// ── Prose / knowledge ────────────────────────────────────────────────────

export const TextContentSchema = BaseContentSchema.extend({
  content_type: z.literal(ContentType.TEXT),
  body: z.string(),
});

export const DocumentContentSchema = BaseContentSchema.extend({
  content_type: z.literal(ContentType.DOCUMENT),
  body: z.string(),
  page_count: z.number().int().positive().optional(),
});

export const ResearchContentSchema = BaseContentSchema.extend({
  content_type: z.literal(ContentType.RESEARCH),
  body: z.string(),
  findings: z.array(z.object({
    claim: z.string(),
    evidence: z.string(),
    source: z.string().url().or(z.string()),
    confidence: z.number().min(0).max(1).optional(),
  })).default([]),
  entities: z.array(z.object({
    name: z.string(),
    type: z.string(),
    description: z.string().optional(),
  })).default([]),
});

export const SOPContentSchema = BaseContentSchema.extend({
  content_type: z.literal(ContentType.SOP),
  body: z.string(),
  version: z.string().default("1.0"),
  supersedes: z.string().optional(),
});

export const DecisionContentSchema = BaseContentSchema.extend({
  content_type: z.literal(ContentType.DECISION),
  body: z.string(),
  status: z.enum(["proposed", "confirmed", "deprecated"]).default("proposed"),
  related: z.array(z.string()).default([]),
});

export const InsightContentSchema = BaseContentSchema.extend({
  content_type: z.literal(ContentType.INSIGHT),
  body: z.string(),
  evidence_refs: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.8),
});

export const SourceContentSchema = BaseContentSchema.extend({
  content_type: z.literal(ContentType.SOURCE),
  body: z.string().optional(),
  url: z.string().url().optional(),
  retrieved_at: z.string().datetime().optional(),
});

export const AgentExecutionContentSchema = BaseContentSchema.extend({
  content_type: z.literal(ContentType.AGENT_EXECUTION),
  body: z.string(),
  agent_type: z.string(),
  task_id: z.string().optional(),
  status: z.enum(["running", "completed", "failed"]),
  progress: z.object({
    current: z.number().int().nonnegative(),
    total: z.number().int().positive(),
    current_item: z.string().optional(),
  }).optional(),
});

export const WebResearchContentSchema = BaseContentSchema.extend({
  content_type: z.literal(ContentType.WEB_RESEARCH),
  body: z.string(),
  queries: z.array(z.string()).default([]),
  sources: z.array(z.object({
    url: z.string().url(),
    title: z.string(),
    snippet: z.string(),
  })).default([]),
});

export const CLAUDESessionContentSchema = BaseContentSchema.extend({
  content_type: z.literal(ContentType.CLAUDE_SESSION),
  body: z.string(),
  session_id: z.string().optional(),
  project: z.string().optional(),
});

export const ClientContentSchema = BaseContentSchema.extend({
  content_type: z.literal(ContentType.CLIENT),
  name: z.string(),
  email: z.string().email().optional(),
  company: z.string().optional(),
  status: z.enum(["active", "paused", "completed", "archived"]).default("active"),
});

// ── Structured data ──────────────────────────────────────────────────────

export const CSVContentSchema = BaseContentSchema.extend({
  content_type: z.literal(ContentType.CSV),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
  row_count: z.number().int().nonnegative(),
  delimiter: z.string().default(","),
});

export const SpreadsheetContentSchema = BaseContentSchema.extend({
  content_type: z.literal(ContentType.SPREADSHEET),
  sheets: z.array(z.object({
    name: z.string(),
    headers: z.array(z.string()),
    rows: z.array(z.array(z.string())),
  })),
});

export const LeadContentSchema = BaseContentSchema.extend({
  content_type: z.literal(ContentType.LEAD),
  email: z.string().email().optional(),
  company: z.string().optional(),
  role: z.string().optional(),
  status: z.enum(["new", "contacted", "qualified", "disqualified"]).default("new"),
  source: z.string().optional(),
});

export const CompanyContentSchema = BaseContentSchema.extend({
  content_type: z.literal(ContentType.COMPANY),
  name: z.string(),
  domain: z.string().optional(),
  industry: z.string().optional(),
  size: z.string().optional(),
  location: z.string().optional(),
});

export const PersonContentSchema = BaseContentSchema.extend({
  content_type: z.literal(ContentType.PERSON),
  name: z.string(),
  email: z.string().email().optional(),
  role: z.string().optional(),
  company: z.string().optional(),
  linkedin: z.string().url().optional(),
});

export const CampaignContentSchema = BaseContentSchema.extend({
  content_type: z.literal(ContentType.CAMPAIGN),
  name: z.string(),
  status: z.enum(["draft", "active", "paused", "completed"]).default("draft"),
  audience: z.string().optional(),
  sequence: z.array(z.object({
    step: z.number().int().positive(),
    subject: z.string(),
    template: z.string(),
    delay_days: z.number().int().nonnegative(),
  })).default([]),
});

export const EmailContentSchema = BaseContentSchema.extend({
  content_type: z.literal(ContentType.EMAIL),
  subject: z.string(),
  body: z.string(),
  from: z.string().email().optional(),
  to: z.string().email().optional(),
  direction: z.enum(["outbound", "inbound"]),
  thread_id: z.string().optional(),
});

export const TaskContentSchema = BaseContentSchema.extend({
  content_type: z.literal(ContentType.TASK),
  body: z.string(),
  assignee: z.string().optional(),
  due_date: z.string().date().optional(),
  status: z.enum(["todo", "in_progress", "done", "cancelled"]).default("todo"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
});

export const ProjectContentSchema = BaseContentSchema.extend({
  content_type: z.literal(ContentType.PROJECT),
  body: z.string(),
  status: z.enum(["planning", "active", "on_hold", "completed"]).default("planning"),
  owner: z.string().optional(),
  deadline: z.string().date().optional(),
});

export const MeetingContentSchema = BaseContentSchema.extend({
  content_type: z.literal(ContentType.MEETING),
  body: z.string(),
  attendees: z.array(z.string()).default([]),
  date: z.string().datetime(),
  duration_minutes: z.number().int().positive().optional(),
  action_items: z.array(z.string()).default([]),
});

// ── Binary / external ────────────────────────────────────────────────────

export const PDFContentSchema = BaseContentSchema.extend({
  content_type: z.literal(ContentType.PDF),
  page_count: z.number().int().positive(),
  extracted_text: z.string().optional(),
  file_size: z.number().int().positive().optional(),
  file_path: z.string().optional(),
});

export const ImageContentSchema = BaseContentSchema.extend({
  content_type: z.literal(ContentType.IMAGE),
  alt_text: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  file_size: z.number().int().positive().optional(),
  file_path: z.string().optional(),
  ocr_text: z.string().optional(),
});

export const LinkContentSchema = BaseContentSchema.extend({
  content_type: z.literal(ContentType.LINK),
  url: z.string().url(),
  title: z.string().optional(),
  description: z.string().optional(),
  favicon: z.string().url().optional(),
});

// ── Fallback ──────────────────────────────────────────────────────────────

export const UnknownContentSchema = BaseContentSchema.extend({
  content_type: z.literal(ContentType.UNKNOWN),
  raw: z.unknown(),
});

/**
 * Union of all schemas. The classifier returns an object that must match
 * one of these; the registry validates via the union discriminator.
 */
export const AnyContentSchema = z.discriminatedUnion("content_type", [
  TextContentSchema,
  DocumentContentSchema,
  ResearchContentSchema,
  SOPContentSchema,
  DecisionContentSchema,
  InsightContentSchema,
  SourceContentSchema,
  AgentExecutionContentSchema,
  WebResearchContentSchema,
  CLAUDESessionContentSchema,
  ClientContentSchema,
  CSVContentSchema,
  SpreadsheetContentSchema,
  LeadContentSchema,
  CompanyContentSchema,
  PersonContentSchema,
  CampaignContentSchema,
  EmailContentSchema,
  TaskContentSchema,
  ProjectContentSchema,
  MeetingContentSchema,
  PDFContentSchema,
  ImageContentSchema,
  LinkContentSchema,
  WebResearchContentSchema,
  UnknownContentSchema,
]);

export type AnyContent = z.infer<typeof AnyContentSchema>;
export type ContentSchema = z.ZodType<AnyContent>;

/**
 * Map from ContentType to its Zod schema. Used by the classifier to pick
 * the right validator, and by the registry to validate before persisting.
 */
export const CONTENT_SCHEMAS: Record<ContentType, z.ZodType<z.infer<typeof AnyContentSchema>>> = {
  [ContentType.TEXT]: TextContentSchema,
  [ContentType.DOCUMENT]: DocumentContentSchema,
  [ContentType.RESEARCH]: ResearchContentSchema,
  [ContentType.SOP]: SOPContentSchema,
  [ContentType.DECISION]: DecisionContentSchema,
  [ContentType.INSIGHT]: InsightContentSchema,
  [ContentType.SOURCE]: SourceContentSchema,
  [ContentType.AGENT_EXECUTION]: AgentExecutionContentSchema,
  [ContentType.WEB_RESEARCH]: WebResearchContentSchema,
  [ContentType.CLAUDE_SESSION]: CLAUDESessionContentSchema,
  [ContentType.CLIENT]: ClientContentSchema,
  [ContentType.CSV]: CSVContentSchema,
  [ContentType.SPREADSHEET]: SpreadsheetContentSchema,
  [ContentType.LEAD]: LeadContentSchema,
  [ContentType.COMPANY]: CompanyContentSchema,
  [ContentType.PERSON]: PersonContentSchema,
  [ContentType.CAMPAIGN]: CampaignContentSchema,
  [ContentType.EMAIL]: EmailContentSchema,
  [ContentType.TASK]: TaskContentSchema,
  [ContentType.PROJECT]: ProjectContentSchema,
  [ContentType.MEETING]: MeetingContentSchema,
  [ContentType.PDF]: PDFContentSchema,
  [ContentType.IMAGE]: ImageContentSchema,
  [ContentType.LINK]: LinkContentSchema,
  [ContentType.UNKNOWN]: UnknownContentSchema,
};

/**
 * Validate a raw parsed object against the schema for its content_type.
 * Returns { success: true, data } or { success: false, error, fallback }.
 * If validation fails, the system falls back to UNKNOWN with the raw payload.
 */
export function validateContent(raw: unknown): {
  success: boolean;
  data?: z.infer<typeof AnyContentSchema>;
  error?: string;
  fallback?: z.infer<typeof AnyContentSchema>;
} {
  if (!raw || typeof raw !== "object" || !("content_type" in raw)) {
    return { success: false, error: "Missing content_type" };
  }
  const ct = (raw as Record<string, unknown>).content_type as string;
  const schema = CONTENT_SCHEMAS[ct as ContentType] ?? UnknownContentSchema;
  const result = schema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data };
  }
  // Validation failed — build UNKNOWN fallback preserving the raw payload
  const fallback = UnknownContentSchema.parse({
    content_type: ContentType.UNKNOWN,
    title: `Unvalidated: ${ct}`,
    tags: [],
    metadata: {},
    raw,
  });
  return {
    success: false,
    error: result.error.message,
    fallback,
  };
}