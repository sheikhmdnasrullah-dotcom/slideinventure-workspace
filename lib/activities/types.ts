import { APPWRITE } from "@/lib/appwrite/config";

export type ActivityCategory =
  | "leads"
  | "documents"
  | "knowledge"
  | "chat"
  | "ai_venture"
  | "todoist"
  | "notes"
  | "terminal"
  | "links"
  | "vault"
  | "integrations"
  | "agents"
  | "concepts"
  | "brainstorm"
  | "system";

export type ActivityAction =
  | "created"
  | "updated"
  | "deleted"
  | "completed"
  | "failed"
  | "imported"
  | "exported"
  | "connected"
  | "executed"
  | "messaged"
  | "edited"
  | "uploaded"
  | "renamed"
  | "moved";

export type Activity = {
  id: string;
  category: ActivityCategory;
  action: ActivityAction;
  title: string;
  description: string;
  entityId?: string;
  entityType?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  userEmail?: string;
};

export type ActivityListOptions = {
  category?: ActivityCategory;
  limit?: number;
  cursor?: string;
};
