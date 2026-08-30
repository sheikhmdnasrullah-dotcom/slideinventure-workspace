import fs from "fs";
import path from "path";
import { upsertItem } from "@/lib/knowledge/sync";

export interface YouTubeProspect {
  id: string;
  channel: string;
  channelName: string;
  emails: string[];
  websites: string[];
  method: string | null;
  researchedAt: string;
  notes?: string;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const PROSPECTS_FILE = path.join(DATA_DIR, "youtube-prospects.json");
const KNOWLEDGE_PROSPECTS_DIR = path.join(process.cwd(), "knowledge", "prospects");
const KNOWLEDGE_FILE = path.join(KNOWLEDGE_PROSPECTS_DIR, "youtube-leads.md");
const SECOND_BRAIN_KNOWLEDGE = path.join(process.cwd(), "SecondBrain", "Knowledge", "youtube-leads.md");

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(KNOWLEDGE_PROSPECTS_DIR)) fs.mkdirSync(KNOWLEDGE_PROSPECTS_DIR, { recursive: true });
  const sbDir = path.dirname(SECOND_BRAIN_KNOWLEDGE);
  if (!fs.existsSync(sbDir)) fs.mkdirSync(sbDir, { recursive: true });
}

function extractChannelName(channelUrl: string): string {
  const clean = channelUrl.replace(/\/about\/?$/, "").replace(/\/videos\/?$/, "");
  const match = clean.match(/@([^/?#]+)/);
  if (match) return `@${match[1]}`;
  const parts = clean.split("/").filter(Boolean);
  return parts[parts.length - 1] || channelUrl;
}

export function getSavedProspects(): YouTubeProspect[] {
  try {
    ensureDirs();
    if (!fs.existsSync(PROSPECTS_FILE)) return [];
    const raw = fs.readFileSync(PROSPECTS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to read saved prospects:", err);
    return [];
  }
}

export async function saveProspects(
  items: Array<{
    channel: string;
    email?: string | null;
    emails?: string[];
    websites?: string[];
    method?: string | null;
    notes?: string;
  }>
): Promise<{ success: boolean; savedCount: number; prospects: YouTubeProspect[] }> {
  try {
    ensureDirs();
    const existing = getSavedProspects();
    const existingByChannel = new Map<string, YouTubeProspect>(
      existing.map((p) => [p.channel.toLowerCase().trim(), p])
    );

    const now = new Date().toISOString();
    let newOrUpdatedCount = 0;

    for (const item of items) {
      const channelKey = item.channel.toLowerCase().trim();
      const channelName = extractChannelName(item.channel);
      const incomingEmails = Array.isArray(item.emails)
        ? item.emails
        : item.email
          ? [item.email]
          : [];
      const cleanEmails = Array.from(new Set(incomingEmails.map((e) => e.trim().toLowerCase()))).filter(Boolean);
      const cleanWebsites = Array.from(new Set((item.websites || []).map((w) => w.trim()))).filter(Boolean);

      const existingRecord = existingByChannel.get(channelKey);
      if (existingRecord) {
        // Merge emails and websites
        const mergedEmails = Array.from(new Set([...existingRecord.emails, ...cleanEmails]));
        const mergedWebsites = Array.from(new Set([...existingRecord.websites, ...cleanWebsites]));
        existingRecord.emails = mergedEmails;
        existingRecord.websites = mergedWebsites;
        if (item.method) existingRecord.method = item.method;
        if (item.notes) existingRecord.notes = item.notes;
        existingRecord.researchedAt = now;
        newOrUpdatedCount++;
      } else {
        const newRecord: YouTubeProspect = {
          id: `yt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          channel: item.channel,
          channelName,
          emails: cleanEmails,
          websites: cleanWebsites,
          method: item.method ?? "headless-browser",
          researchedAt: now,
          notes: item.notes,
        };
        existingByChannel.set(channelKey, newRecord);
        newOrUpdatedCount++;
      }
    }

    const updatedList = Array.from(existingByChannel.values()).sort(
      (a, b) => new Date(b.researchedAt).getTime() - new Date(a.researchedAt).getTime()
    );

    // 1. Save to local JSON storage
    fs.writeFileSync(PROSPECTS_FILE, JSON.stringify(updatedList, null, 2), "utf-8");

    // 2. Generate and sync Knowledge markdown sheet
    await syncToKnowledge(updatedList);

    return { success: true, savedCount: newOrUpdatedCount, prospects: updatedList };
  } catch (err) {
    console.error("Failed to save prospects:", err);
    return { success: false, savedCount: 0, prospects: getSavedProspects() };
  }
}

export async function deleteProspect(id: string): Promise<boolean> {
  try {
    ensureDirs();
    const existing = getSavedProspects();
    const filtered = existing.filter((p) => p.id !== id);
    fs.writeFileSync(PROSPECTS_FILE, JSON.stringify(filtered, null, 2), "utf-8");
    await syncToKnowledge(filtered);
    return true;
  } catch (err) {
    console.error("Failed to delete prospect:", err);
    return false;
  }
}

/**
 * Builds a markdown table and updates both the filesystem and Appwrite knowledge item.
 */
async function syncToKnowledge(prospects: YouTubeProspect[]) {
  try {
    const totalEmails = prospects.reduce((acc, p) => acc + p.emails.length, 0);
    const dateStr = new Date().toISOString().split("T")[0];

    const markdownRows = prospects.map((p, idx) => {
      const emailsStr = p.emails.length ? p.emails.join(", ") : "*None found*";
      const sitesStr = p.websites.length ? p.websites.map((w) => `[Link](${w})`).join(" ") : "-";
      return `| ${idx + 1} | **${p.channelName}** | [Channel](${p.channel}) | ${emailsStr} | ${sitesStr} | ${p.method || "browser"} | ${p.researchedAt.slice(0, 10)} |`;
    });

    const markdownContent = `# YouTube Researched Prospects & Leads

> Automatically generated and maintained by the **YouTube Email Agent**.
> Total Researched Channels: **${prospects.length}** | Total Discovered Emails: **${totalEmails}** | Last Updated: **${dateStr}**

## Researched Prospects Sheet

| # | Channel | URL | Emails | Websites | Extraction Method | Date |
|---|---|---|---|---|---|---|
${markdownRows.join("\n")}

---
*Exported directly to Knowledge Base from YouTube Email Extractor Agent.*
`;

    // 1. Write to knowledge/prospects/youtube-leads.md
    fs.writeFileSync(KNOWLEDGE_FILE, markdownContent, "utf-8");

    // 2. Write to SecondBrain/Knowledge/youtube-leads.md
    try {
      fs.writeFileSync(SECOND_BRAIN_KNOWLEDGE, markdownContent, "utf-8");
    } catch {
      // ignore
    }

    // 3. Upsert into Appwrite knowledge base under a fixed slug. addKnowledgeItem()
    // generates a fresh unique slug every call (checked against the local
    // filesystem mirror, which this function has just written to), so calling
    // it here would create a new "-1", "-2", "-3" ... item on every sync
    // instead of updating one running sheet. upsertItem() keys on `slug`
    // directly, which is what this recurring summary actually needs.
    await upsertItem({
      slug: "youtube-researched-prospects-sheet",
      item_id: "youtube-researched-prospects-sheet",
      type: "research",
      title: "YouTube Researched Prospects Sheet",
      body: markdownContent,
      content_path: "/knowledge/youtube-researched-prospects-sheet.md",
      content_type: "markdown",
      status: "proposed",
      source: "youtube-email-agent",
      author: "YouTube Email Agent",
      tags: ["youtube", "prospects", "leads", "email-extractor"],
    }).catch((e) => console.warn("Failed to upsert youtube leads knowledge item:", e));
  } catch (err) {
    console.error("Error in syncToKnowledge:", err);
  }
}
