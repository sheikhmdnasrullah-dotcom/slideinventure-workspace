import { databases, ID } from "@/lib/appwrite/server";
import { APPWRITE } from "@/lib/appwrite/config";

export type AuditActor = {
  userEmail?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
};

export type AuditEntry = {
  table: string;
  recordId: string;
  action: "insert" | "update" | "delete" | "read" | "export" | "import" | "login" | "logout" | "send" | "configure";
  diff?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  actor?: AuditActor;
};

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await databases.createDocument(
      APPWRITE.databaseId,
      APPWRITE.collections.auditLogs,
      ID.unique(),
      {
        table_name: entry.table,
        record_id: entry.recordId,
        action: entry.action,
        diff: entry.diff ? JSON.stringify(entry.diff) : null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        actor_email: entry.actor?.userEmail ?? null,
        actor_id: entry.actor?.userId ?? null,
        ip: entry.actor?.ip ?? null,
        user_agent: entry.actor?.userAgent ?? null,
        created_at: new Date().toISOString(),
      }
    );
  } catch {
    // Audit logging must not break the primary flow
  }
}
