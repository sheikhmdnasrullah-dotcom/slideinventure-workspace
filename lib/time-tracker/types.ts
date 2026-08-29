export type WorkSessionSource = "manual_stopwatch" | "automatic";

export interface WorkSession {
  id: string;
  userEmail: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  duration: number; // in seconds
  date: string; // YYYY-MM-DD
  project: string; // e.g. "AI Venture", "Research Lab", "Leads"
  note?: string;
  source: WorkSessionSource;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type TimerStatus = "idle" | "running" | "paused";

export interface TimerState {
  status: TimerStatus;
  startedAt: number | null; // epoch ms when the current running segment started
  pausedAt: number | null; // epoch ms when paused
  accumulatedSeconds: number; // seconds accumulated before current run segment
  project: string;
  note: string;
  lastUpdated: number; // epoch ms
}

export interface LastSessionInfo {
  id: string;
  startTime: string;
  endTime: string;
  duration: number;
  project: string;
  note?: string;
  formattedRange: string; // e.g. "11:42 PM – 1:08 AM"
}

export interface WorkTimeSummary {
  today: {
    focusTimeSeconds: number;
    sessionsCount: number;
    lastSession: LastSessionInfo | null;
    estimatedActiveSeconds: number;
  };
  thisWeek: {
    focusTimeSeconds: number;
    sessionsCount: number;
  };
  thisMonth: {
    focusTimeSeconds: number;
    sessionsCount: number;
  };
  recentSessions: WorkSession[];
}

export interface CreateSessionInput {
  startTime: string;
  endTime: string;
  duration: number;
  project?: string;
  note?: string;
  source?: WorkSessionSource;
  metadata?: Record<string, unknown>;
}

export interface UpdateSessionInput {
  project?: string;
  note?: string;
  duration?: number;
}
