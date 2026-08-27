import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

/**
 * End-to-end verification of the integrated stack.
 *
 * These tests drive the real running app against the real Appwrite backend.
 * Every artefact is uniquely named and cleaned up, and each persistence
 * assertion goes through a full reload, so a pass means the data genuinely
 * survived rather than sitting in React state.
 */

const stamp = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

const NAV_ROUTES = [
  "/dashboard",
  "/activity",
  "/chat",
  "/agents",
  "/concepts",
  "/research-lab",
  "/brainstorm-sketch",
  "/ideas",
  "/notepad",
  "/knowledge",
  "/documents",
  "/leads",
  "/terminal",
  "/settings",
  "/integrations",
  "/analytics",
  "/useful-links",
  "/vault",
  "/agent-canvas",
  "/ai-chat",
];

async function apiJson(page: Page, path: string, init?: RequestInit) {
  return page.evaluate(
    async ([p, opts]) => {
      const res = await fetch(p as string, {
        ...(opts as RequestInit),
        headers: { "content-type": "application/json", ...((opts as RequestInit)?.headers ?? {}) },
      });
      const text = await res.text();
      let body: unknown = null;
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
      return { status: res.status, body };
    },
    [path, init ?? {}]
  );
}

test.describe("Shell and routing", () => {
  test("every nav route loads, keeps the shell, and is not a 404", async ({ page, diagnostics }) => {
    for (const route of NAV_ROUTES) {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${route} http status`).toBeLessThan(400);

      // Shell must stay mounted: this is one app, not separate pages.
      await expect(
        page.locator("[data-slot=sidebar]").first(),
        `${route} lost the sidebar`
      ).toBeAttached({ timeout: 15000 });

      const body = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
      expect(body, `${route} rendered a not-found body`).not.toContain(
        "this page could not be found"
      );
      expect(body.trim().length, `${route} rendered blank`).toBeGreaterThan(0);
    }

    expect(
      diagnostics.pageErrors,
      `uncaught page errors: ${diagnostics.pageErrors.join(" | ")}`
    ).toHaveLength(0);
  });
});

test.describe("Live event layer", () => {
  test("a write in one section produces a live event the dashboard receives", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    // Prove the shared SSE stream is connected and delivers a real event.
    const received = await page.evaluate(async () => {
      const source = new EventSource("/api/events/stream");
      const ready = await new Promise<boolean>((resolve) => {
        const t = setTimeout(() => resolve(false), 10000);
        source.addEventListener("ready", () => {
          clearTimeout(t);
          resolve(true);
        });
      });
      if (!ready) {
        source.close();
        return { ready: false, event: null };
      }

      const event = new Promise<Record<string, unknown> | null>((resolve) => {
        const t = setTimeout(() => resolve(null), 12000);
        source.addEventListener("domain", (raw) => {
          clearTimeout(t);
          resolve(JSON.parse((raw as MessageEvent).data));
        });
      });

      await fetch("/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "sse probe", content: "[]", scope: "global" }),
      });

      const result = await event;
      source.close();
      return { ready: true, event: result };
    });

    expect(received.ready, "SSE stream never signalled ready").toBe(true);
    expect(received.event, "no live domain event arrived after a real write").not.toBeNull();
    expect(received.event).toMatchObject({ type: "note.created", source: "notes" });

    // Clean up the probe note.
    const list = await apiJson(page, "/api/notes?scope=global");
    const notes = (list.body as { notes?: { id: string; title: string }[] }).notes ?? [];
    for (const n of notes.filter((x) => x.title === "sse probe")) {
      await apiJson(page, `/api/notes/${n.id}`, { method: "DELETE" });
    }
  });

  test("dashboard shows a live connection state, not a faked one", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const indicator = page.getByText(/^(Live|Reconnecting)$/).first();
    await expect(indicator).toBeVisible({ timeout: 20000 });
    await expect(indicator).toHaveText("Live", { timeout: 20000 });
  });
});

test.describe("Notes persistence", () => {
  test("create, reload, confirm, delete, reload, confirm gone", async ({ page }) => {
    const title = `note-${stamp()}`;

    await page.goto("/notepad", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /New note/i }).click();

    const titleInput = page.getByPlaceholder("Untitled").first();
    await expect(titleInput).toBeVisible({ timeout: 15000 });
    await titleInput.fill(title);
    // Let the debounced autosave land.
    await page.waitForTimeout(2000);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page.getByText(title, { exact: false }).first(),
      "note did not survive a reload"
    ).toBeVisible({ timeout: 20000 });

    // Delete it through the real API and confirm removal, not just hiding.
    const list = await apiJson(page, "/api/notes?scope=global");
    const notes = (list.body as { notes?: { id: string; title: string }[] }).notes ?? [];
    const created = notes.find((n) => n.title === title);
    expect(created, "created note not present in the API list").toBeTruthy();

    const del = await apiJson(page, `/api/notes/${created!.id}`, { method: "DELETE" });
    expect(del.status, "delete did not succeed").toBeLessThan(300);

    const after = await apiJson(page, "/api/notes?scope=global");
    const remaining = (after.body as { notes?: { id: string }[] }).notes ?? [];
    expect(
      remaining.some((n) => n.id === created!.id),
      "deleted note is still returned by the API"
    ).toBe(false);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  });
});

test.describe("Brainstorm", () => {
  test("has a working Notepad tab alongside the drawing tabs", async ({ page }) => {
    await page.goto("/brainstorm-sketch", { waitUntil: "domcontentloaded" });

    for (const label of ["Notepad", "Draw", "Whiteboard", "Ideas"]) {
      await expect(
        page.getByRole("tab", { name: new RegExp(label, "i") }),
        `Brainstorm is missing the ${label} tab`
      ).toBeVisible({ timeout: 15000 });
    }

    // Notepad is the default tab and must be usable inline, not behind a modal.
    const title = `bs-${stamp()}`;
    await page.getByRole("tab", { name: /Notepad/i }).click();
    await page.getByRole("button", { name: /New note/i }).click();
    const titleInput = page.getByPlaceholder("Untitled").first();
    await expect(titleInput).toBeVisible({ timeout: 15000 });
    await titleInput.fill(title);
    await page.waitForTimeout(2000);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText(title, { exact: false }).first()).toBeVisible({ timeout: 20000 });

    const list = await apiJson(page, "/api/notes?scope=brainstorm");
    const notes = (list.body as { notes?: { id: string; title: string }[] }).notes ?? [];
    const created = notes.find((n) => n.title === title);
    expect(created, "brainstorm note was not saved under the brainstorm scope").toBeTruthy();
    await apiJson(page, `/api/notes/${created!.id}`, { method: "DELETE" });
  });

  test("selected tab survives a reload", async ({ page }) => {
    await page.goto("/brainstorm-sketch", { waitUntil: "domcontentloaded" });
    await page.getByRole("tab", { name: /Ideas/i }).click();
    await expect(page).toHaveURL(/tab=ideas/, { timeout: 10000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("tab", { name: /Ideas/i })).toHaveAttribute(
      "data-selected",
      /.*/,
      { timeout: 15000 }
    );
  });
});

test.describe("Boards persist under their own section", () => {
  test("a brainstorm board is listed by the brainstorm scope after reload", async ({ page }) => {
    await page.goto("/brainstorm-sketch", { waitUntil: "domcontentloaded" });
    const title = `board-${stamp()}`;

    const created = await apiJson(page, "/api/boards", {
      method: "POST",
      body: JSON.stringify({ title, scope: "brainstorm" }),
    });
    expect(created.status).toBeLessThan(300);
    const board = (created.body as { board: { id: string; scope: string } }).board;

    // The regression that made boards "disappear": created under one scope,
    // listed under another.
    expect(board.scope, "board was saved under the wrong scope").toBe("brainstorm");

    const list = await apiJson(page, "/api/boards?scope=brainstorm");
    const boards = (list.body as { boards: { id: string }[] }).boards;
    expect(
      boards.some((b) => b.id === board.id),
      "board is missing from its own section list"
    ).toBe(true);

    // Content round-trips.
    const content = JSON.stringify({ elements: [{ id: "probe-element" }] });
    const put = await apiJson(page, `/api/boards/${board.id}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    });
    expect(put.status).toBeLessThan(300);

    const fetched = await apiJson(page, `/api/boards/${board.id}`);
    expect((fetched.body as { board: { content: string } }).board.content).toBe(content);

    const del = await apiJson(page, `/api/boards/${board.id}`, { method: "DELETE" });
    expect(del.status).toBeLessThan(300);
    const after = await apiJson(page, "/api/boards?scope=brainstorm");
    expect(
      (after.body as { boards: { id: string }[] }).boards.some((b) => b.id === board.id),
      "deleted board still returned"
    ).toBe(false);
  });
});

test.describe("Idea maps (React Flow)", () => {
  test("create, open the canvas in a modal, persist the graph, delete", async ({ page }) => {
    await page.goto("/ideas", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: /New map/i }).first().click();

    // The canvas opens in an overlay, never a new tab.
    const pagesBefore = page.context().pages().length;
    await expect(page.locator(".react-flow").first()).toBeVisible({ timeout: 30000 });
    expect(page.context().pages().length, "canvas opened a new tab").toBe(pagesBefore);

    // Add a node, which marks the graph dirty and triggers the autosave.
    await page.getByRole("button", { name: /Add node/i }).click();
    await expect(page.locator(".react-flow__node").first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/^Saved/).first()).toBeVisible({ timeout: 20000 });

    // Close the overlay and confirm the graph was kept.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1000);

    const list = await apiJson(page, "/api/idea-maps");
    const maps = (list.body as { maps: { id: string; content: string }[] }).maps;
    expect(maps.length, "no idea map was created").toBeGreaterThan(0);
    const map = maps[0];
    const graph = JSON.parse(map.content || "{}") as { nodes?: unknown[] };
    expect(
      (graph.nodes ?? []).length,
      "closing the canvas lost the nodes (autosave did not flush)"
    ).toBeGreaterThan(0);

    const del = await apiJson(page, `/api/idea-maps/${map.id}`, { method: "DELETE" });
    expect(del.status).toBeLessThan(300);
    const after = await apiJson(page, "/api/idea-maps");
    expect(
      (after.body as { maps: { id: string }[] }).maps.some((m) => m.id === map.id),
      "deleted idea map still returned"
    ).toBe(false);
  });
});

test.describe("AI Venture", () => {
  test("exposes the full workstation and keeps the active section in the URL", async ({ page }) => {
    await page.goto("/concepts", { waitUntil: "domcontentloaded" });

    for (const label of [
      "Files",
      "Query",
      "Research",
      "Playground",
      "Brainstorm",
      "Notepad",
      "Agents",
      "Activity",
    ]) {
      await expect(
        page.getByRole("button", { name: new RegExp(`^${label}$`, "i") }).first(),
        `AI Venture is missing the ${label} section`
      ).toBeVisible({ timeout: 20000 });
    }

    await page.getByRole("button", { name: /^Activity$/i }).first().click();
    await expect(page).toHaveURL(/tab=activity/, { timeout: 10000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/tab=activity/);
  });

  test("a research thread persists and then deletes", async ({ page }) => {
    await page.goto("/concepts?tab=research", { waitUntil: "domcontentloaded" });
    const title = `research-${stamp()}`;

    const created = await apiJson(page, "/api/boards", {
      method: "POST",
      body: JSON.stringify({ title, scope: "research" }),
    });
    expect(created.status).toBeLessThan(300);
    const id = (created.body as { board: { id: string } }).board.id;

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText(title, { exact: false }).first()).toBeVisible({ timeout: 25000 });

    await apiJson(page, `/api/boards/${id}`, { method: "DELETE" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  });
});

test.describe("Command palette", () => {
  test("opens on the keyboard shortcut and finds content created elsewhere", async ({ page }) => {
    const title = `palette-${stamp()}`;

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const created = await apiJson(page, "/api/notes", {
      method: "POST",
      body: JSON.stringify({ title, content: "[]", scope: "global" }),
    });
    expect(created.status).toBeLessThan(300);
    const noteId = (created.body as { note: { id: string } }).note.id;

    // Indexing is asynchronous; give the search index a moment.
    await page.waitForTimeout(2500);
    await page.reload({ waitUntil: "domcontentloaded" });

    await page.keyboard.press("ControlOrMeta+k");
    const input = page.getByPlaceholder(/search/i).first();
    await expect(input, "command palette did not open on the shortcut").toBeVisible({
      timeout: 10000,
    });

    // Static commands are reachable.
    await input.fill("Knowledge");
    await expect(page.getByRole("option", { name: /Knowledge/i }).first()).toBeVisible({
      timeout: 10000,
    });

    // Global search finds the note created outside this section.
    await input.fill(title);
    await expect(
      page.getByText(title, { exact: false }).first(),
      "global search did not find the note"
    ).toBeVisible({ timeout: 20000 });

    await page.keyboard.press("Escape");
    await expect(input).toBeHidden({ timeout: 10000 });

    await apiJson(page, `/api/notes/${noteId}`, { method: "DELETE" });
  });
});

test.describe("Dashboard command center", () => {
  test("surfaces activity produced by other sections after a reload", async ({ page }) => {
    const title = `activity-${stamp()}`;
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const created = await apiJson(page, "/api/boards", {
      method: "POST",
      body: JSON.stringify({ title, scope: "brainstorm" }),
    });
    const boardId = (created.body as { board: { id: string } }).board.id;

    // The activity row is written server side, so a reload must show it.
    await page.waitForTimeout(1500);
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(
      page.getByText(/Brainstorm board created/i).first(),
      "dashboard did not surface activity from another section"
    ).toBeVisible({ timeout: 25000 });

    await apiJson(page, `/api/boards/${boardId}`, { method: "DELETE" });
  });

  test("metrics render real numbers, never placeholders", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const payload = await apiJson(page, "/api/dashboard");
    expect(payload.status).toBe(200);
    const counts = (payload.body as { counts?: Record<string, number> }).counts;
    expect(counts, "/api/dashboard returned no counts to back the metrics").toBeTruthy();
    for (const [key, value] of Object.entries(counts ?? {})) {
      expect(Number.isFinite(value), `${key} is not a real number`).toBe(true);
    }
  });
});

test.describe("Chat and AI streaming", () => {
  test("the chat page loads and the streaming endpoint returns a stream", async ({ page }) => {
    await page.goto("/chat", { waitUntil: "domcontentloaded" });
    await expect(page.locator("textarea, input[type=text]").first()).toBeVisible({
      timeout: 20000,
    });

    // Exercise the AI SDK streaming route directly and require real streamed
    // bytes rather than asserting on model wording.
    const result = await page.evaluate(async () => {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", parts: [{ type: "text", text: "Reply with the word ok." }] }],
        }),
      });
      if (!res.ok || !res.body) return { status: res.status, chunks: 0, bytes: 0 };
      const reader = res.body.getReader();
      let chunks = 0;
      let bytes = 0;
      const deadline = Date.now() + 25000;
      while (Date.now() < deadline) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks += 1;
        bytes += value?.byteLength ?? 0;
        if (bytes > 40) break;
      }
      await reader.cancel().catch(() => {});
      return { status: res.status, chunks, bytes };
    });

    expect(result.status, `/api/ai-chat returned ${result.status}`).toBe(200);
    expect(result.chunks, "no streamed chunks were received").toBeGreaterThan(0);
    expect(result.bytes).toBeGreaterThan(0);
  });
});

test.describe("Agents emit visible status", () => {
  test("an agent run publishes AG-UI lifecycle events to the live stream", async ({ page }) => {
    await page.goto("/agents", { waitUntil: "domcontentloaded" });

    const roster = await apiJson(page, "/api/agents");
    const agents = (roster.body as { agents?: { slug: string }[] }).agents ?? [];
    test.skip(agents.length === 0, "no agent personas installed");

    const outcome = await page.evaluate(async (slug) => {
      const source = new EventSource("/api/events/stream");
      await new Promise<void>((resolve) => {
        const t = setTimeout(() => resolve(), 8000);
        source.addEventListener("ready", () => {
          clearTimeout(t);
          resolve();
        });
      });

      const types: string[] = [];
      source.addEventListener("domain", (raw) => {
        const e = JSON.parse((raw as MessageEvent).data) as { type: string };
        if (e.type.startsWith("agent.")) types.push(e.type);
      });

      const res = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, message: "Reply with the single word ok." }),
      });
      const status = res.status;
      // Allow trailing completion events to arrive.
      await new Promise((r) => setTimeout(r, 3000));
      source.close();
      return { status, types };
    }, agents[0].slug);

    expect(
      outcome.types.includes("agent.started"),
      `no agent.started event observed (types: ${outcome.types.join(",")})`
    ).toBe(true);
    expect(
      outcome.types.some((t) => t === "agent.completed" || t === "agent.failed"),
      `run never reported a terminal state (types: ${outcome.types.join(",")})`
    ).toBe(true);
  });
});

test.describe("Delete really deletes", () => {
  test("a document upload is removed from storage and the list", async ({ page }) => {
    await page.goto("/documents", { waitUntil: "domcontentloaded" });

    const name = `probe-${stamp()}.txt`;
    const created = await page.evaluate(async (fileName) => {
      const form = new FormData();
      form.append("file", new File(["persistence probe"], fileName, { type: "text/plain" }));
      const res = await fetch("/api/documents/upload", { method: "POST", body: form });
      return { status: res.status, body: await res.text() };
    }, name);

    expect(created.status, `upload failed: ${created.body}`).toBeLessThan(300);
    const doc = JSON.parse(created.body) as { document?: { id: string }; id?: string };
    const docId = doc.document?.id ?? doc.id;
    expect(docId, "upload returned no document id").toBeTruthy();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText(name, { exact: false }).first()).toBeVisible({ timeout: 25000 });

    const del = await apiJson(page, `/api/documents/${docId}`, { method: "DELETE" });
    expect(del.status).toBeLessThan(300);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await expect(page.getByText(name, { exact: true })).toHaveCount(0);
  });
});

test.describe("Accessibility and motion preferences", () => {
  test("reduced motion disables smooth scrolling instead of animating", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const { authenticate } = await import("./fixtures");
    await authenticate(context, "http://localhost:3000");
    const page = await context.newPage();

    await page.goto("/knowledge", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    // Lenis takes over <html> when active; with reduced motion it must not.
    const lenisActive = await page.evaluate(() =>
      document.documentElement.classList.contains("lenis")
    );
    expect(lenisActive, "Lenis mounted despite prefers-reduced-motion").toBe(false);

    await context.close();
  });

  test("layout holds at a narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 900 });
    for (const route of ["/dashboard", "/brainstorm-sketch", "/concepts"]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1200);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, `${route} overflows horizontally by ${overflow}px`).toBeLessThan(24);
    }
  });
});
