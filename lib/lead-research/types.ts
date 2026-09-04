import "server-only";

export type LeadStatus = "pending" | "researching" | "done" | "error";

export type LeadResearchRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  position: string;
  // 3-4 hyper-personalized lines about this person, guaranteed unique
  // across the whole list, grounded in authentic public sources.
  personalizedInfo: string;
  researchSnippets: string[];
  status: LeadStatus;
  error?: string;
};

export type SessionStatus = "pending" | "running" | "done" | "error";

export type LeadResearchSession = {
  id: string;
  owner: string;
  status: SessionStatus;
  fileName: string;
  rows: LeadResearchRow[];
  discoveredColumns: string[];
  agentSlugs: string[];
  progress: number; // 0..1
  doneCount: number;
  totalCount: number;
  createdAt: string;
  updatedAt: string;
};
