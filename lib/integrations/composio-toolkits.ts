// Curated shortlist of toolkits an agent is actually likely to need (email,
// calendar, sheets, chat, docs, code) rather than Composio's full 500+ app
// marketplace. Plain data, safe to import from the client Connect buttons.
export const CONNECTABLE_TOOLKITS = [
  { slug: "gmail", name: "Gmail" },
  { slug: "googlecalendar", name: "Google Calendar" },
  { slug: "googlesheets", name: "Google Sheets" },
  { slug: "slack", name: "Slack" },
  { slug: "notion", name: "Notion" },
  { slug: "github", name: "GitHub" },
] as const;

export type ConnectableToolkitSlug = (typeof CONNECTABLE_TOOLKITS)[number]["slug"];
