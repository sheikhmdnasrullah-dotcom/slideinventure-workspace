import "server-only";
import { runBrowseTask } from "@/lib/browse/agent";
import { databases, ID, Query } from "@/lib/appwrite/server";
import { APPWRITE } from "@/lib/appwrite/config";
import { logActivity } from "@/lib/activities/client";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Lead harvest: drive the browse agent over YouTube for a niche,
 * let it solve any CAPTCHAs it meets, and pull channel contact emails back
 * into the leads collection. Demonstrates the full agentic loop
 * (browse -> captcha -> extract -> persist).
 */
export async function harvestLeads(opts: {
  topic: string;
  userEmail: string;
}): Promise<{ ok: boolean; harvested: number; candidates: number; emails: string[]; error?: string }> {
  const task = `Search YouTube for "${opts.topic}". Open several channel "About" pages and find their public contact or business email addresses (look for mailto: links or visible emails; solve any CAPTCHA you encounter). Note the channel name too. Return a concise bulleted list, one item per line, formatted exactly as: email: Channel Name. Only include real email addresses. Skip channels with no public email.`;

  const startUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(opts.topic)}`;

  const res = await runBrowseTask({ task, startUrl, userEmail: opts.userEmail, maxSteps: 8 });
  if (!res.ok) {
    return { ok: false, harvested: 0, candidates: 0, emails: [], error: res.error };
  }

  const found = [...new Set((res.result.match(EMAIL_RE) || []).map((e) => e.toLowerCase()))];

  const parsed = found.map((email) => {
    const line = res.result.split("\n").find((l) => l.includes(email)) || "";
    const name = line
      .replace(email, "")
      .replace(/[—–-]/g, " ")
      .replace(/[^\w\s.]/g, "")
      .trim()
      .slice(0, 80);
    return { email, name: name || null };
  });

  const DB = APPWRITE.databaseId;
  const COL = APPWRITE.collections.leads;
  const created: string[] = [];
  const now = new Date().toISOString();

  for (const f of parsed) {
    const existing = await databases.listDocuments(DB, COL, [Query.equal("email", f.email), Query.limit(1)]);
    if (existing.documents.length) continue;
    const doc = await databases.createDocument(DB, COL, ID.unique(), {
      first_name: f.name ? f.name.split(" ")[0] : "",
      last_name: f.name && f.name.includes(" ") ? f.name.split(" ").slice(1).join(" ") : "",
      email: f.email,
      company: f.name || null,
      source: "youtube-harvest",
      status: "new",
      tags: ["harvest", opts.topic].slice(0, 1),
      custom_fields: JSON.stringify({ topic: opts.topic }),
      created_at: now,
      updated_at: now,
    });
    created.push(doc.$id);
  }

  await logActivity({
    category: "leads",
    action: "imported",
    title: "Lead harvest",
    description: `Harvested ${created.length} leads for "${opts.topic}" (${found.length} candidate emails)`,
    entityType: "leads",
    notify: true,
    metadata: { topic: opts.topic, harvested: created.length, candidates: found.length },
  }).catch(() => {});

  return { ok: true, harvested: created.length, candidates: found.length, emails: found };
}
