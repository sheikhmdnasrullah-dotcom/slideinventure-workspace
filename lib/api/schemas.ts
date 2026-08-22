"use server";

import { z } from "zod";

// ---------------------------------------------------------------
// 1. Users
// ---------------------------------------------------------------
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  role: z.enum(["owner", "admin", "member", "viewer"]).default("member"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;

// ---------------------------------------------------------------
// 2. Leads
// ---------------------------------------------------------------
export const LeadSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email"),
  company: z.string().optional().nullable(),
  jobTitle: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  source: z.string().default("manual"),
  status: z.string().default("new"),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  customFields: z.record(z.unknown()).default({}),
  lastContactedAt: z.string().datetime().optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Lead = z.infer<typeof LeadSchema>;

// ---------------------------------------------------------------
// 3. Custom Lead Fields
// ---------------------------------------------------------------
export const CustomLeadFieldSchema = z.object({
  id: z.string().uuid(),
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "number", "date", "select", "multiselect", "boolean"]),
  options: z.array(z.string()).optional(),
  required: z.boolean().default(false),
  visible: z.boolean().default(true),
  sortable: z.boolean().default(true),
  filterable: z.boolean().default(false),
  width: z.number().int().positive().optional(),
  order: z.number().int().nonnegative().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CustomLeadField = z.infer<typeof CustomLeadFieldSchema>;

// ---------------------------------------------------------------
// 4. Lead Table Configuration
// ---------------------------------------------------------------
export const LeadColumnConfigSchema = z.object({
  id: z.string(),
  key: z.string(),
  label: z.string(),
  visible: z.boolean().default(true),
  sortable: z.boolean().default(true),
  filterable: z.boolean().default(false),
  type: z.enum(["text", "composite", "status", "select", "actions", "custom"]),
  width: z.number().int().positive().optional(),
});

export type LeadColumnConfig = z.infer<typeof LeadColumnConfigSchema>;

// ---------------------------------------------------------------
// 5. Imported Files
// ---------------------------------------------------------------
export const ImportedFileSchema = z.object({
  id: z.string().uuid(),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  storagePath: z.string(),
  url: z.string().url().optional(),
  mapping: z.record(z.string()).optional(),
  rowCount: z.number().int().nonnegative().optional(),
  importedCount: z.number().int().nonnegative().optional(),
  errorCount: z.number().int().nonnegative().optional(),
  status: z.enum(["pending", "processing", "completed", "failed"]).default("pending"),
  errors: z.array(z.string()).optional(),
  importedBy: z.string().email().optional(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().optional().nullable(),
});

export type ImportedFile = z.infer<typeof ImportedFileSchema>;

// ---------------------------------------------------------------
// 6. Documents
// ---------------------------------------------------------------
export const DocumentSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  storagePath: z.string(),
  url: z.string().url().optional(),
  tags: z.array(z.string()).default([]),
  status: z.string().default("active"),
  author: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Document = z.infer<typeof DocumentSchema>;

// ---------------------------------------------------------------
// 7. Knowledge
// ---------------------------------------------------------------
export const KnowledgeItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string().min(1),
  slug: z.string(),
  contentPath: z.string(),
  body: z.string().optional().nullable(),
  status: z.string().default("proposed"),
  confidence: z.number().optional().nullable(),
  source: z.string().optional().nullable(),
  author: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  embedding: z.string().optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  searchVector: z.string().optional().nullable(),
  filePath: z.string().optional().nullable(),
  contentType: z.string().default("markdown"),
});

export type KnowledgeItem = z.infer<typeof KnowledgeItemSchema>;

// ---------------------------------------------------------------
// 8. Useful Links
// ---------------------------------------------------------------
export const UsefulLinkSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  url: z.string().url(),
  description: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  favicon: z.string().url().optional().nullable(),
  createdBy: z.string().email().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type UsefulLink = z.infer<typeof UsefulLinkSchema>;

// ---------------------------------------------------------------
// 9. Apps
// ---------------------------------------------------------------
export const AppSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  url: z.string().url().optional().nullable(),
  category: z.string().optional().nullable(),
  enabled: z.boolean().default(true),
  config: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type App = z.infer<typeof AppSchema>;

// ---------------------------------------------------------------
// 10. Integrations
// ---------------------------------------------------------------
export const IntegrationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  provider: z.string().min(1),
  type: z.enum(["oauth", "api_key", "webhook", "imap", "smtp"]),
  status: z.enum(["active", "inactive", "error"]).default("inactive"),
  config: z.record(z.unknown()).default({}),
  lastSyncAt: z.string().datetime().optional().nullable(),
  lastError: z.string().optional().nullable(),
  createdBy: z.string().email().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Integration = z.infer<typeof IntegrationSchema>;

// ---------------------------------------------------------------
// 11. Email Accounts
// ---------------------------------------------------------------
export const EmailAccountSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1),
  imapHost: z.string().min(1),
  imapPort: z.number().int().positive(),
  smtpHost: z.string().min(1),
  smtpPort: z.number().int().positive(),
  status: z.enum(["active", "inactive", "error"]).default("inactive"),
  lastSyncAt: z.string().datetime().optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type EmailAccount = z.infer<typeof EmailAccountSchema>;

// ---------------------------------------------------------------
// 12. Emails
// ---------------------------------------------------------------
export const EmailSchema = z.object({
  id: z.string(),
  uid: z.number().int().positive(),
  folder: z.string(),
  from: z.string().email(),
  fromName: z.string().optional().nullable(),
  to: z.array(z.string().email()).default([]),
  cc: z.array(z.string().email()).default([]),
  subject: z.string().optional().nullable(),
  bodyText: z.string().optional().nullable(),
  bodyHtml: z.string().optional().nullable(),
  sentAt: z.string().datetime().optional().nullable(),
  isRead: z.boolean().default(false),
  hasAttachments: z.boolean().default(false),
  messageId: z.string().optional().nullable(),
  inReplyTo: z.string().optional().nullable(),
  labels: z.array(z.string()).default([]),
  fetchedAt: z.string().datetime().optional().nullable(),
});

export type Email = z.infer<typeof EmailSchema>;

// ---------------------------------------------------------------
// 13. Email Drafts
// ---------------------------------------------------------------
export const EmailDraftSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  to: z.array(z.string().email()).min(1),
  cc: z.array(z.string().email()).default([]),
  bcc: z.array(z.string().email()).default([]),
  subject: z.string().optional().nullable(),
  body: z.string().optional().nullable(),
  replyToMessageId: z.string().optional().nullable(),
  createdBy: z.string().email().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type EmailDraft = z.infer<typeof EmailDraftSchema>;

// ---------------------------------------------------------------
// 14. Email Attachments
// ---------------------------------------------------------------
export const EmailAttachmentSchema = z.object({
  id: z.string().uuid(),
  emailId: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  contentId: z.string().optional().nullable(),
  disposition: z.string().optional().nullable(),
  downloadUrl: z.string().url().optional().nullable(),
  createdAt: z.string().datetime(),
});

export type EmailAttachment = z.infer<typeof EmailAttachmentSchema>;

// ---------------------------------------------------------------
// 15. Miro Activity
// ---------------------------------------------------------------
export const MiroActivitySchema = z.object({
  id: z.string().uuid(),
  eventType: z.string(),
  boardId: z.string().optional().nullable(),
  cardId: z.string().optional().nullable(),
  userId: z.string().optional().nullable(),
  userName: z.string().optional().nullable(),
  action: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime(),
});

export type MiroActivity = z.infer<typeof MiroActivitySchema>;

// ---------------------------------------------------------------
// 16. Notion Activity
// ---------------------------------------------------------------
export const NotionActivitySchema = z.object({
  id: z.string().uuid(),
  eventType: z.string(),
  pageId: z.string().optional().nullable(),
  blockId: z.string().optional().nullable(),
  userId: z.string().optional().nullable(),
  userName: z.string().optional().nullable(),
  action: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime(),
});

export type NotionActivity = z.infer<typeof NotionActivitySchema>;

// ---------------------------------------------------------------
// 17. Todoist Tasks
// ---------------------------------------------------------------
export const TodoistTaskSchema = z.object({
  id: z.string().uuid(),
  externalId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  content: z.string().min(1),
  description: z.string().optional().nullable(),
  priority: z.number().int().min(1).max(4).default(1),
  dueDate: z.string().datetime().optional().nullable(),
  completed: z.boolean().default(false),
  assignee: z.string().email().optional().nullable(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TodoistTask = z.infer<typeof TodoistTaskSchema>;

// ---------------------------------------------------------------
// 18. Terminal Commands
// ---------------------------------------------------------------
export const TerminalCommandSchema = z.object({
  id: z.string().uuid(),
  command: z.string().min(1),
  cwd: z.string().optional().nullable(),
  exitCode: z.number().int().optional().nullable(),
  stdout: z.string().optional().nullable(),
  stderr: z.string().optional().nullable(),
  durationMs: z.number().int().nonnegative().optional().nullable(),
  triggeredBy: z.string().email().optional().nullable(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime(),
});

export type TerminalCommand = z.infer<typeof TerminalCommandSchema>;

// ---------------------------------------------------------------
// 19. Secret Vault Entries
// ---------------------------------------------------------------
export const SecretVaultEntrySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  category: z.string().optional().nullable(),
  encryptedValue: z.string().min(1),
  iv: z.string().min(1),
  tag: z.string().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  createdBy: z.string().email().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type SecretVaultEntry = z.infer<typeof SecretVaultEntrySchema>;

// ---------------------------------------------------------------
// 20. Audit Logs
// ---------------------------------------------------------------
export const AuditLogSchema = z.object({
  id: z.string().uuid(),
  tableName: z.string(),
  recordId: z.string(),
  action: z.enum(["insert", "update", "delete", "read", "export", "import", "login", "logout", "send", "configure"]),
  diff: z.record(z.unknown()).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
  actorEmail: z.string().email().optional().nullable(),
  actorId: z.string().optional().nullable(),
  ip: z.string().ip().optional().nullable(),
  userAgent: z.string().optional().nullable(),
  createdAt: z.string().datetime(),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;
