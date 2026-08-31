import "server-only";
import { databases, ID, Query } from "@/lib/appwrite/server";
import { APPWRITE } from "@/lib/appwrite/config";
import { crawlEmails, type CrawlStep } from "@/lib/leads/email-crawler";
import { detectRowLink, type DetectedLinkType } from "@/lib/leads/link-detect";

// Durable batch job for the Email Crawler's CSV bulk mode. Rows live as one
// JSON blob on the batch document (mirrors the agentJobs pattern) so a batch
// survives the browser closing or a serverless function recycling. Processing
// is resumable: any row still "pending" (or "running" past the stale
// threshold, meaning its worker died) gets picked up by the next call to
// processEmailCrawlerBatch — triggered once on upload, and again, lazily, by
// the status-poll route if the batch looks stalled. This is the same
// "worker run via waitUntil on enqueue, or lazily by the poll endpoint"
// pattern lib/agents/jobs-store.ts already uses.
const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.emailCrawlerBatches;

// Rows are stored as one JSON blob per batch on a single Appwrite string
// attribute (capped at 500 KB), so a big upload is split into several batches
// of BATCH_CHUNK_SIZE rather than imposing a hard per-intake row limit. 100
// rows per chunk keeps the blob comfortably under that ceiling and lets the
// batches run in parallel across background workers.
export const BATCH_CHUNK_SIZE = 100;
// Longer than the slowest single-row run observed in practice (a full 5-agent
// exhaustion took ~6 minutes), so a batch is only ever resumed once a worker
// has clearly died, never while it's just working a slow row.
const STALE_MS = 10 * 60 * 1000;
const CONCURRENCY = 2;

export type BatchRowStatus = "pending" | "running" | "done" | "error";

export type EmailCrawlerBatchRow = {
  index: number;
  input: Record<string, string>;
  detectedType: DetectedLinkType;
  detectedLink: string | null;
  status: BatchRowStatus;
  emails: string[];
  verdicts: string[];
  agent: string | null;
  error: string | null;
};

export type EmailCrawlerBatch = {
  id: string;
  owner: string;
  filename: string;
  status: "pending" | "running" | "done" | "error";
  total: number;
  completed: number;
  rows: EmailCrawlerBatchRow[];
  createdAt: string;
  updatedAt: string;
};

let ensured: Promise<void> | null = null;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForCollection(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await databases.getCollection(DB, COL);
      return;
    } catch {
      // still provisioning
    }
    await sleep(1500);
  }
}

async function waitForAttributes(timeoutMs = 40_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const attrs = await databases.listAttributes(DB, COL);
      const keys = new Set((attrs.attributes ?? []).map((a: { key: string }) => a.key));
      if (["owner", "filename", "status", "total", "completed", "rows", "created_at", "updated_at"].every((k) => keys.has(k))) {
        return;
      }
    } catch {
      // still provisioning
    }
    await sleep(1500);
  }
}

export function ensureEmailCrawlerBatchesCollection(): Promise<void> {
  if (ensured) return ensured;
  ensured = (async () => {
    try {
      try {
        await databases.getCollection(DB, COL);
        return;
      } catch {
        // not present yet
      }
      try {
        await databases.createCollection(DB, COL, "Email Crawler Batches");
      } catch (e) {
        if (!/already exists|exists/i.test(String((e as Error)?.message))) throw e;
      }
      await waitForCollection();
      const str = async (key: string, size: number, required: boolean) => {
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            await databases.createStringAttribute(DB, COL, key, size, required);
            return;
          } catch (e) {
            if (/already exists|exists/i.test(String((e as Error)?.message))) return;
            await sleep(1000);
          }
        }
        console.error("failed to create attribute", key);
      };
      const int = async (key: string, required: boolean) => {
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            await databases.createIntegerAttribute(DB, COL, key, required, 0);
            return;
          } catch (e) {
            if (/already exists|exists/i.test(String((e as Error)?.message))) return;
            await sleep(1000);
          }
        }
        console.error("failed to create attribute", key);
      };
      await str("owner", 200, true);
      await str("filename", 300, true);
      await str("status", 16, true);
      await int("total", true);
      await int("completed", true);
      await str("rows", 500000, true);
      await str("created_at", 64, true);
      await str("updated_at", 64, true);
      await waitForAttributes();
    } catch (e) {
      ensured = null; // allow a later retry
      throw e;
    }
  })();
  return ensured;
}

function serialize(doc: {
  $id: string;
  owner: string;
  filename: string;
  status: EmailCrawlerBatch["status"];
  total: number;
  completed: number;
  rows: string;
  created_at: string;
  updated_at: string;
}): EmailCrawlerBatch {
  let rows: EmailCrawlerBatchRow[] = [];
  try {
    rows = JSON.parse(doc.rows ?? "[]");
  } catch {
    rows = [];
  }
  return {
    id: doc.$id,
    owner: doc.owner,
    filename: doc.filename,
    status: doc.status,
    total: doc.total,
    completed: doc.completed,
    rows,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

export async function createEmailCrawlerBatch(
  owner: string,
  filename: string,
  rows: Record<string, string>[]
): Promise<EmailCrawlerBatch> {
  await ensureEmailCrawlerBatchesCollection();
  const batchRows: EmailCrawlerBatchRow[] = rows.map((input, index) => {
    const detected = detectRowLink(input);
    return {
      index,
      input,
      detectedType: detected.type,
      detectedLink: detected.link,
      status: "pending",
      emails: [],
      verdicts: [],
      agent: null,
      error: null,
    };
  });

  const now = new Date().toISOString();
  const doc = await databases.createDocument(DB, COL, ID.unique(), {
    owner,
    filename: filename.slice(0, 300),
    status: "pending",
    total: batchRows.length,
    completed: 0,
    rows: JSON.stringify(batchRows),
    created_at: now,
    updated_at: now,
  });
  return serialize(doc as unknown as Parameters<typeof serialize>[0]);
}

/**
 * Splits an arbitrarily large CSV upload into several background batches (each
 * capped at BATCH_CHUNK_SIZE so no single Appwrite document blows past the
 * 500 KB rows attribute), then returns every batch. Previously a hard per-intake
 * cap silently truncated big lists — now there is no intake limit; the upload is
 * just chunked and every chunk is processed.
 */
export async function createEmailCrawlerBatches(
  owner: string,
  filename: string,
  rows: Record<string, string>[]
): Promise<EmailCrawlerBatch[]> {
  const batches: EmailCrawlerBatch[] = [];
  for (let i = 0; i < rows.length; i += BATCH_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + BATCH_CHUNK_SIZE);
    const suffix = Math.floor(i / BATCH_CHUNK_SIZE) > 0 ? ` (part ${Math.floor(i / BATCH_CHUNK_SIZE) + 1})` : "";
    batches.push(await createEmailCrawlerBatch(owner, `${filename}${suffix}`, chunk));
  }
  return batches;
}

export async function getEmailCrawlerBatch(id: string, owner: string): Promise<EmailCrawlerBatch | null> {
  try {
    const doc = await databases.getDocument(DB, COL, id);
    const batch = serialize(doc as unknown as Parameters<typeof serialize>[0]);
    if (batch.owner !== owner) return null;
    return batch;
  } catch {
    return null;
  }
}

/** Like getEmailCrawlerBatch but skips the owner check — used by internal
 * background workers that drive a batch by id alone. */
export async function getEmailCrawlerBatchRaw(id: string): Promise<EmailCrawlerBatch | null> {
  try {
    const doc = await databases.getDocument(DB, COL, id);
    return serialize(doc as unknown as Parameters<typeof serialize>[0]);
  } catch {
    return null;
  }
}

/** True when a batch looks abandoned by its worker and safe to resume. */
export function isBatchStale(batch: EmailCrawlerBatch): boolean {
  if (batch.status !== "running") return false;
  return Date.now() - new Date(batch.updatedAt).getTime() > STALE_MS;
}

// Serializes writes to one batch document within this process so two rows
// finishing at nearly the same time (CONCURRENCY > 1) never clobber each
// other's result with a stale read-modify-write.
const writeChains = new Map<string, Promise<unknown>>();
function withBatchLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const prior = writeChains.get(id) ?? Promise.resolve();
  const next = prior.then(fn, fn);
  writeChains.set(
    id,
    next.then(
      () => undefined,
      () => undefined
    )
  );
  return next;
}

async function patchRow(id: string, index: number, patch: Partial<EmailCrawlerBatchRow>): Promise<void> {
  await withBatchLock(id, async () => {
    const doc = await databases.getDocument(DB, COL, id).catch(() => null);
    if (!doc) return;
    const batch = serialize(doc as unknown as Parameters<typeof serialize>[0]);
    const row = batch.rows.find((r) => r.index === index);
    if (!row) return;
    Object.assign(row, patch);
    const completed = batch.rows.filter((r) => r.status === "done" || r.status === "error").length;
    await databases.updateDocument(DB, COL, id, {
      rows: JSON.stringify(batch.rows),
      completed,
      updated_at: new Date().toISOString(),
    });
  });
}

function pickWinningAgent(trail: CrawlStep[]): string | null {
  return trail.find((s) => s.status === "success")?.label ?? null;
}

/**
 * Processes every pending row (and any "running" row a dead worker left
 * behind) with limited concurrency, persisting progress after each one so
 * the batch is safely resumable and a slow or failing row never blocks the
 * rest of the list from completing.
 */
export async function processEmailCrawlerBatch(id: string): Promise<void> {
  const doc = await databases.getDocument(DB, COL, id).catch(() => null);
  if (!doc) return;
  let batch = serialize(doc as unknown as Parameters<typeof serialize>[0]);
  if (batch.status === "done") return;

  // A row stuck "running" only means something if we ourselves decided this
  // batch is stale before calling in; reset those so they're picked up below
  // instead of being skipped forever.
  const toReset = batch.rows.filter((r) => r.status === "running").map((r) => r.index);
  if (toReset.length) {
    await withBatchLock(id, async () => {
      const fresh = serialize((await databases.getDocument(DB, COL, id)) as unknown as Parameters<typeof serialize>[0]);
      for (const row of fresh.rows) {
        if (row.status === "running") row.status = "pending";
      }
      await databases.updateDocument(DB, COL, id, {
        rows: JSON.stringify(fresh.rows),
        status: "running",
        updated_at: new Date().toISOString(),
      });
    });
  } else {
    await databases.updateDocument(DB, COL, id, { status: "running", updated_at: new Date().toISOString() }).catch(() => {});
  }

  const fresh = await databases.getDocument(DB, COL, id).catch(() => null);
  if (!fresh) return;
  batch = serialize(fresh as unknown as Parameters<typeof serialize>[0]);
  const queue = batch.rows.filter((r) => r.status === "pending");

  let cursor = 0;
  async function worker() {
    while (cursor < queue.length) {
      const row = queue[cursor++];
      await patchRow(id, row.index, { status: "running" });
      try {
        const rowText = Object.entries(row.input)
          .map(([k, v]) => `${k}: ${v}`)
          .join(" | ");
        const details = (row.detectedLink ? `[detected: ${row.detectedType}] ${rowText}` : rowText).slice(0, 2000);
        const result = await crawlEmails({
          link: row.detectedLink ?? undefined,
          details,
          userEmail: batch.owner,
        });
        await patchRow(id, row.index, {
          status: "done",
          emails: result.emails.map((e) => e.email),
          verdicts: result.emails.map((e) => e.verdict),
          agent: pickWinningAgent(result.trail),
          error: null,
        });
      } catch (e) {
        await patchRow(id, row.index, {
          status: "error",
          error: e instanceof Error ? e.message : "crawl failed",
        });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length || 1) }, worker));

  const finalDoc = await databases.getDocument(DB, COL, id).catch(() => null);
  if (!finalDoc) return;
  const finalBatch = serialize(finalDoc as unknown as Parameters<typeof serialize>[0]);
  const stillPending = finalBatch.rows.some((r) => r.status === "pending" || r.status === "running");
  await databases
    .updateDocument(DB, COL, id, {
      status: stillPending ? "running" : "done",
      updated_at: new Date().toISOString(),
    })
    .catch(() => {});
}

/**
 * Processes a batch, then — if any row is still pending/running — schedules the
 * next cycle in a *fresh* background window by pinging the resume endpoint.
 * This is what lets a large upload keep crawling long after the dashboard tab is
 * closed: serverless `waitUntil` only lasts `maxDuration` seconds, so instead of
 * one big run we chain many short windows together until every row is done.
 */
export async function processEmailCrawlerBatchAndChain(id: string, origin: string): Promise<void> {
  await processEmailCrawlerBatch(id);
  const batch = await getEmailCrawlerBatchRaw(id);
  if (!batch) return;
  const stillPending = batch.rows.some((r) => r.status === "pending" || r.status === "running");
  if (stillPending) {
    const url = `${origin.replace(/\/$/, "")}/api/email-crawler/batch/${id}/resume`;
    await fetch(url, { method: "GET" }).catch(() => {});
  }
}

/** Ids of batches stuck in "running" past the stale threshold — used by the
 * CRON worker as a safety net that re-drives batches the chain missed. */
export async function listStaleEmailCrawlerBatches(limit = 50): Promise<string[]> {
  const now = Date.now();
  const res = await databases
    .listDocuments(DB, COL, [Query.equal("status", "running"), Query.limit(limit)])
    .catch(() => ({ documents: [] as Array<{ $id: string; updated_at: string }> }));
  return (res.documents as Array<{ $id: string; updated_at: string }>)
    .filter((d) => now - new Date(d.updated_at).getTime() > STALE_MS)
    .map((d) => d.$id);
}
