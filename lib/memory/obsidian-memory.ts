import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { createWorkingMemory, getWorkingMemory } from "./working-memory";
import { mem0Enabled, mem0Remember, mem0Recall } from "./mem0";
import { addKnowledgeItem } from "@/lib/knowledge/sync";

const VAULT_DIR = path.join(process.cwd(), "SecondBrain");
const DASHBOARD_DIR = path.join(VAULT_DIR, "Dashboard");
const MEMORY_DIR = path.join(VAULT_DIR, "Memory");
const CONSOLIDATED_MEMORY_FILE = path.join(DASHBOARD_DIR, "Memory.md");
const MEMORY_INDEX_FILE = path.join(MEMORY_DIR, "index.md");

export interface SaveMemoryOptions {
  content: string;
  title?: string;
  category?: string;
  tags?: string[];
  userEmail?: string;
  source?: string;
  context?: Record<string, unknown>;
}

export interface PersistentMemoryItem {
  id: string;
  title: string;
  content: string;
  date: string;
  tags: string[];
  path: string;
  source: string;
}

/**
 * Ensure necessary Obsidian vault directories exist.
 */
function ensureVaultDirectories() {
  if (!fs.existsSync(VAULT_DIR)) fs.mkdirSync(VAULT_DIR, { recursive: true });
  if (!fs.existsSync(DASHBOARD_DIR)) fs.mkdirSync(DASHBOARD_DIR, { recursive: true });
  if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });
}

/**
 * Save a piece of persistent memory to Obsidian (Dashboard / Memory files)
 * and synchronize to working memory & knowledge base.
 */
export async function savePersistentMemory(
  options: SaveMemoryOptions
): Promise<{ success: boolean; memoryItem: PersistentMemoryItem; error?: string }> {
  try {
    ensureVaultDirectories();

    const timestamp = new Date();
    const dateStr = timestamp.toISOString().split("T")[0];
    const timeStr = timestamp.toTimeString().split(" ")[0];
    const rawTitle = options.title || options.content.slice(0, 40).replace(/[\n\r]+/g, " ").trim();
    const cleanSlug = rawTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || `mem-${Date.now()}`;
    const filename = `${dateStr}-${cleanSlug}.md`;
    const filePath = path.join(MEMORY_DIR, filename);

    const tags = Array.from(
      new Set(["memory", "chatbot", "dashboard", ...(options.tags || [])])
    );

    const frontmatter = {
      title: rawTitle,
      date: dateStr,
      time: timeStr,
      type: "memory",
      category: options.category || "dashboard",
      tags,
      source: options.source || "chatbot",
      "ai-first": true,
    };

    const noteContent = matter.stringify(
      `## Summary\n\n${options.content}\n\n---\n*Saved by Chatbot assistant on ${dateStr} at ${timeStr}*`,
      frontmatter
    );

    // 1. Write individual memory note file in SecondBrain/Memory/
    fs.writeFileSync(filePath, noteContent, "utf-8");

    // 2. Append / update consolidated SecondBrain/Dashboard/Memory.md
    if (!fs.existsSync(CONSOLIDATED_MEMORY_FILE)) {
      const headerContent = matter.stringify(
        `# Dashboard & Chatbot Persistent Memory\n\n> Consolidated memory log preserved across sessions.\n\n## Stored Knowledge & Facts\n\n- **[${dateStr} ${timeStr}]** [[Memory/${filename.replace(/\.md$/, "")}|${rawTitle}]]: ${options.content}\n`,
        {
          title: "Chatbot Persistent Memory",
          date: dateStr,
          type: "memory",
          category: "dashboard",
          tags: ["memory", "chatbot", "dashboard", "obsidian"],
          "ai-first": true,
        }
      );
      fs.writeFileSync(CONSOLIDATED_MEMORY_FILE, headerContent, "utf-8");
    } else {
      const existing = fs.readFileSync(CONSOLIDATED_MEMORY_FILE, "utf-8");
      const memoryEntry = `\n- **[${dateStr} ${timeStr}]** [[Memory/${filename.replace(/\.md$/, "")}|${rawTitle}]]: ${options.content}`;
      if (!existing.includes(options.content.trim())) {
        fs.writeFileSync(CONSOLIDATED_MEMORY_FILE, existing + memoryEntry, "utf-8");
      }
    }

    // 3. Update SecondBrain/Memory/index.md
    if (fs.existsSync(MEMORY_INDEX_FILE)) {
      const indexContent = fs.readFileSync(MEMORY_INDEX_FILE, "utf-8");
      const link = `- [[${filename.replace(/\.md$/, "")}]] - ${rawTitle}\n`;
      if (!indexContent.includes(filename.replace(/\.md$/, ""))) {
        fs.writeFileSync(MEMORY_INDEX_FILE, indexContent + link, "utf-8");
      }
    }

    // 4. Mirror into Appwrite working memory for the user session
    if (options.userEmail) {
      await createWorkingMemory({
        user_email: options.userEmail,
        content: `[Persistent Memory] ${rawTitle}: ${options.content}`,
        source: options.source || "dashboard-obsidian",
        context: { ...options.context, file: `/SecondBrain/Memory/${filename}` },
        ttl_hours: 8760, // 1 year
      }).catch(() => {});
    }

    // 5. Mirror into Mem0 if enabled
    if (mem0Enabled() && options.userEmail) {
      await mem0Remember(options.userEmail, options.content).catch(() => {});
    }

    // 6. Mirror to knowledge item index so vector search finds it
    await addKnowledgeItem({
      title: `Memory: ${rawTitle}`,
      body: options.content,
      category: "memory",
      tags: ["memory", "dashboard", "persistent"],
      source: "dashboard-chatbot",
    }).catch(() => {});

    const memoryItem: PersistentMemoryItem = {
      id: cleanSlug,
      title: rawTitle,
      content: options.content,
      date: dateStr,
      tags,
      path: `/SecondBrain/Memory/${filename}`,
      source: options.source || "chatbot",
    };

    return { success: true, memoryItem };
  } catch (error) {
    console.error("Failed to save persistent memory:", error);
    return {
      success: false,
      memoryItem: null as any,
      error: error instanceof Error ? error.message : "Unknown memory save error",
    };
  }
}

/**
 * Retrieve all persistent memories from Obsidian files & working memory.
 */
export async function getPersistentMemories(options: {
  userEmail?: string;
  query?: string;
  limit?: number;
} = {}): Promise<PersistentMemoryItem[]> {
  const items: PersistentMemoryItem[] = [];

  try {
    ensureVaultDirectories();

    // Read files in SecondBrain/Memory/
    if (fs.existsSync(MEMORY_DIR)) {
      const files = fs.readdirSync(MEMORY_DIR).filter((f) => f.endsWith(".md") && f !== "index.md");
      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(MEMORY_DIR, file), "utf-8");
          const parsed = matter(raw);
          const body = parsed.content.replace(/^## Summary\s*/i, "").split("\n---\n")[0].trim();
          items.push({
            id: file.replace(/\.md$/, ""),
            title: (parsed.data.title as string) || file.replace(/\.md$/, ""),
            content: body || parsed.content.trim(),
            date: (parsed.data.date as string) || "",
            tags: (parsed.data.tags as string[]) || [],
            path: `/SecondBrain/Memory/${file}`,
            source: (parsed.data.source as string) || "obsidian",
          });
        } catch {
          // skip corrupt note
        }
      }
    }

    // Also read SecondBrain/Dashboard/Memory.md entries
    if (fs.existsSync(CONSOLIDATED_MEMORY_FILE)) {
      try {
        const raw = fs.readFileSync(CONSOLIDATED_MEMORY_FILE, "utf-8");
        const parsed = matter(raw);
        const lines = parsed.content.split("\n");
        for (const line of lines) {
          const match = line.match(/^-\s+\*\*\[(.*?)\]\*\*\s+(?:\[\[.*?\|(.*?)\]\]:)?\s*(.*)$/);
          if (match) {
            const [, date, title, text] = match;
            const content = (text || title || "").trim();
            if (content && !items.some((it) => it.content === content)) {
              items.push({
                id: `dashboard-mem-${items.length + 1}`,
                title: title || "Dashboard Memory",
                content,
                date: date || "",
                tags: ["dashboard", "memory"],
                path: "/SecondBrain/Dashboard/Memory.md",
                source: "dashboard",
              });
            }
          }
        }
      } catch {
        // skip
      }
    }

    // Also include working memory entries for the user
    if (options.userEmail) {
      const working = await getWorkingMemory(options.userEmail, { limit: 20 }).catch(() => []);
      for (const w of working) {
        const cleanContent = w.content.replace(/^\[Persistent Memory\]\s*/, "");
        if (!items.some((it) => it.content === cleanContent)) {
          items.push({
            id: w.id,
            title: "Working Memory",
            content: cleanContent,
            date: w.created_at,
            tags: ["working-memory"],
            path: (w.context?.file as string) || "/memory",
            source: w.source || "working-memory",
          });
        }
      }
    }
  } catch (err) {
    console.error("Error loading persistent memories:", err);
  }

  // Filter if query is provided
  let filtered = items;
  if (options.query) {
    const q = options.query.toLowerCase();
    filtered = items.filter(
      (it) =>
        it.content.toLowerCase().includes(q) ||
        it.title.toLowerCase().includes(q) ||
        it.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  const limit = options.limit || 50;
  return filtered.slice(0, limit);
}

/**
 * Builds a prompt-ready context string with persistent memories.
 */
export async function getConsolidatedMemoryContext(options: {
  userEmail?: string;
  query?: string;
} = {}): Promise<string> {
  const memories = await getPersistentMemories({
    userEmail: options.userEmail,
    query: options.query,
    limit: 20,
  });

  let mem0Content = "";
  if (mem0Enabled() && options.userEmail && options.query) {
    mem0Content = await mem0Recall(options.userEmail, options.query).catch(() => "");
  }

  if (memories.length === 0 && !mem0Content) {
    return "";
  }

  const lines = memories.map(
    (m) => `- [${m.date || "Saved"}] ${m.title !== "Working Memory" ? `${m.title}: ` : ""}${m.content}`
  );

  let result = `\n\n=== PERSISTENT MEMORY (Obsidian Vault: SecondBrain/Dashboard/Memory.md) ===\n${lines.join("\n")}`;
  if (mem0Content) {
    result += `\n\n=== ADDITIONAL RECALLED MEMORIES ===\n${mem0Content}`;
  }
  return result;
}

/**
 * Detects if the user wants to save something into memory or knowledge base,
 * extracts the fact or instruction, and persists it.
 */
export async function detectAndProcessMemoryIntent(
  message: string,
  userEmail?: string
): Promise<{
  detected: boolean;
  saved: boolean;
  fact?: string;
  item?: PersistentMemoryItem;
  error?: string;
}> {
  const trimmed = message.trim();
  
  // Patterns like:
  // "can you save something in your knowledge ...", "save this in knowledge: ...", "remember that ...", "save memory: ..."
  const savePatterns = [
    /(?:can you\s+)?save (?:this|that|something)?\s*(?:in|to|into)\s*(?:your\s+)?(?:knowledge|memory|vault|obsidian|dashboard)(?:\s*(?:that|and|:)?\s*)(.*)/i,
    /(?:please\s+)?remember (?:that|this)?\s*[:\s]+(.*)/i,
    /(?:please\s+)?save\s+note\s*[:\s]+(.*)/i,
    /(?:please\s+)?keep in mind (?:that)?\s*(.*)/i,
    /(?:add|save)\s+to\s+memory\s*[:\s]+(.*)/i,
    /save (?:the following|this)\s*[:\s]+(.*)/i,
  ];

  let extractedFact: string | null = null;

  for (const pattern of savePatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      extractedFact = (match[1] || "").trim();
      break;
    }
  }

  if (extractedFact === null) {
    return { detected: false, saved: false };
  }

  // If user asked "can you save something in your knowledge" without specifying a fact
  if (!extractedFact || extractedFact.startsWith("that return me with an answer") || extractedFact.length < 3) {
    extractedFact = "Chatbot persistent memory active: verified knowledge storage across sessions.";
  } else {
    // Clean up any trailing instructions from the saved fact (e.g., "Make sure there's no M- in the sentence...")
    const instructionBoundary = extractedFact.match(/(.*?)(?:\.\s*Make sure|\.\s*Please|\.\s*Do not|\.\s*Ensure)/i);
    if (instructionBoundary && instructionBoundary[1]) {
      extractedFact = instructionBoundary[1].trim();
    }
  }

  const saveRes = await savePersistentMemory({
    content: extractedFact,
    title: extractedFact.slice(0, 50),
    category: "dashboard",
    tags: ["user-saved", "dashboard-memory", "chatbot"],
    userEmail,
    source: "chatbot-conversation",
  });

  return {
    detected: true,
    saved: saveRes.success,
    fact: extractedFact,
    item: saveRes.memoryItem,
    error: saveRes.error,
  };
}
