/**
 * Contextual message engine for the Personal Business Operating System.
 *
 * Generates crisp, founder-grade messages rooted in actual workspace state
 * rather than random generic quotes.
 */

export const MOTIVATIONAL_MESSAGES = [
  "Still up. Make the next hour count.",
  "Keep building. Small progress compounds.",
  "You already started. Finish one meaningful thing.",
  "Your workspace is moving. Keep the momentum.",
  "Turn the idea into something real.",
  "One focused session can change the trajectory of a week.",
  "Don't organize forever. Execute.",
  "Your next useful action is more important than another plan.",
  "Research it. Understand it. Build it.",
  "Keep going — you're creating your own system.",
  "One more meaningful task.",
  "Capture the idea before it disappears.",
  "Turn today's notes into tomorrow's decisions.",
  "Your research is becoming an asset.",
  "Make progress visible.",
  "Focus on the highest-leverage thing.",
  "You don't need a perfect plan. You need the next move.",
  "Keep experimenting.",
  "Build the system you actually want to use.",
  "Another session. Another step forward.",
] as const;

export interface ContextualEvaluationInput {
  hour: number;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ...
  todayActivityCount: number;
  todayFocusMinutes: number;
  openTasksCount: number;
  openResearchCount: number;
  lastSessionMinutesAgo?: number | null;
  lastSessionDurationMinutes?: number | null;
}

export function getContextualGreeting(hour: number): { greeting: string; subtitle: string } {
  if (hour >= 0 && hour < 5) {
    return {
      greeting: "You're still up.",
      subtitle: "Late-night execution window. Make the focus count.",
    };
  }
  if (hour >= 5 && hour < 12) {
    return {
      greeting: "Good morning.",
      subtitle: "Fresh start. Set the pace for today's execution.",
    };
  }
  if (hour >= 12 && hour < 18) {
    return {
      greeting: "Good afternoon.",
      subtitle: "Midday momentum. Lock in on the highest-leverage task.",
    };
  }
  if (hour >= 18 && hour < 22) {
    return {
      greeting: "Good evening.",
      subtitle: "Evening sprint. Close out open loops and synthesize progress.",
    };
  }
  return {
    greeting: "Still working.",
    subtitle: "Late-night research and execution session.",
  };
}

export function getSmartContextMessage(input: ContextualEvaluationInput): {
  headline: string;
  subtext: string;
  badge?: string;
  tone: "focus" | "momentum" | "caution" | "action";
} {
  const {
    hour,
    dayOfWeek,
    todayActivityCount,
    todayFocusMinutes,
    openTasksCount,
    openResearchCount,
    lastSessionMinutesAgo,
    lastSessionDurationMinutes,
  } = input;

  // 1. Just completed a massive session (> 60 mins within last 30 mins)
  if (
    lastSessionDurationMinutes &&
    lastSessionDurationMinutes >= 60 &&
    lastSessionMinutesAgo !== null &&
    lastSessionMinutesAgo !== undefined &&
    lastSessionMinutesAgo <= 30
  ) {
    return {
      headline: "That's a serious focus session.",
      subtext: "Capture what you learned in a quick note before switching context.",
      badge: "Deep Work Completed",
      tone: "momentum",
    };
  }

  // 2. Late Night (< 5 AM or >= 11 PM)
  if (hour < 5 || hour >= 23) {
    return {
      headline: "Still up. Make the next hour count.",
      subtext: "Eliminate secondary distractions and finish one core deliverable.",
      badge: "Late Night Focus",
      tone: "focus",
    };
  }

  // 3. Monday Kickoff (early morning)
  if (dayOfWeek === 1 && hour < 11) {
    return {
      headline: "New week. New execution.",
      subtext: "One focused sprint today changes the entire trajectory of your week.",
      badge: "Week Kickoff",
      tone: "action",
    };
  }

  // 4. Strong run today (5+ actions or >= 90 mins focus)
  if (todayActivityCount >= 5 || todayFocusMinutes >= 90) {
    return {
      headline: "You're on a strong run today.",
      subtext: "Your workspace is moving forward. Keep the momentum alive.",
      badge: "High Momentum",
      tone: "momentum",
    };
  }

  // 5. Open tasks awaiting
  if (openTasksCount > 0 && todayActivityCount === 0) {
    return {
      headline: "You have unfinished work.",
      subtext: `Choose the highest-leverage task among your ${openTasksCount} pending items and execute.`,
      badge: "Pending Actions",
      tone: "action",
    };
  }

  // 6. Open research threads
  if (openResearchCount > 0) {
    return {
      headline: "Your research has open threads.",
      subtext: "Turn recent findings into concrete business decisions.",
      badge: "Research Active",
      tone: "focus",
    };
  }

  // 7. Quiet day so far
  if (todayActivityCount <= 1 && todayFocusMinutes < 15) {
    return {
      headline: "Quiet day so far.",
      subtext: "Pick one important thing and move it forward right now.",
      badge: "Ready",
      tone: "action",
    };
  }

  // 8. Default high-caliber fallback (contextually pinned by date)
  const dayIndex = (new Date().getDate() + hour) % MOTIVATIONAL_MESSAGES.length;
  const quote = MOTIVATIONAL_MESSAGES[dayIndex];

  return {
    headline: quote,
    subtext: "Build the system you actually want to use.",
    badge: "Command Center",
    tone: "focus",
  };
}
