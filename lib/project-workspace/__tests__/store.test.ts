import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectStore, WorkspaceError } from "../store.js";

const OWNER = "owner-1";
const EMAIL = "owner@example.com";

function freshStore() {
  const dir = mkdtempSync(join(tmpdir(), "pw-test-"));
  return { dir, store: new ProjectStore(dir) };
}

function hasCode(code: string) {
  return (err: unknown) =>
    (err instanceof WorkspaceError || (err as { name?: string })?.name === "InvalidPathError") &&
    (err as { code?: string }).code === code;
}

async function rejectsCode(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, hasCode(code));
}

function rejectsCodeSync(fn: () => unknown, code: string) {
  assert.throws(fn, hasCode(code));
}

describe("ProjectStore projects", () => {
  let dir = "";
  let store: ProjectStore;
  beforeEach(() => {
    const fresh = freshStore();
    dir = fresh.dir;
    store = fresh.store;
  });

  it("creates, lists, renames, and deletes projects", () => {
    const p = store.createProject(OWNER, EMAIL, "Acme Launch", "desc");
    assert.equal(p.name, "Acme Launch");
    assert.equal(store.listProjects(OWNER).length, 1);
    const renamed = store.updateProject(OWNER, p.id, { name: "Acme v2" });
    assert.equal(renamed.name, "Acme v2");
    store.deleteProject(OWNER, p.id);
    assert.equal(store.listProjects(OWNER).length, 0);
    rmSync(dir, { recursive: true, force: true });
  });

  it("isolates owners from each other", () => {
    const p = store.createProject(OWNER, EMAIL, "Private");
    assert.equal(store.listProjects("someone-else").length, 0);
    rejectsCodeSync(() => store.getProject("someone-else", p.id), "NOT_FOUND");
    rejectsCodeSync(() => store.deleteProject("someone-else", p.id), "NOT_FOUND");
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("ProjectStore files", () => {
  let dir = "";
  let store: ProjectStore;
  let projectId = "";
  beforeEach(() => {
    const fresh = freshStore();
    dir = fresh.dir;
    store = fresh.store;
    projectId = store.createProject(OWNER, EMAIL, "P").id;
  });

  it("creates folders and text files, then reads them back", async () => {
    store.createFolder(OWNER, projectId, "docs/strategy");
    const created = store.writeNewFile(OWNER, projectId, "docs/strategy/icp.md", "# ICP\n");
    assert.equal(created.path, "docs/strategy/icp.md");
    assert.equal(created.editable, true);
    const read = await store.readFile(OWNER, projectId, "docs/strategy/icp.md");
    assert.equal(read.content, "# ICP\n");
    assert.equal(read.hash, created.hash);
    const tree = store.listTree(OWNER, projectId);
    assert.equal(tree[0]?.name, "docs");
    rmSync(dir, { recursive: true, force: true });
  });

  it("blocks path traversal on write and read", async () => {
    rejectsCodeSync(() => store.writeNewFile(OWNER, projectId, "../evil.md", "x"), "INVALID_PATH");
    rejectsCodeSync(() => store.createFolder(OWNER, projectId, ".workspace/x"), "INVALID_PATH");
    await rejectsCode(store.readFile(OWNER, projectId, ".."), "INVALID_PATH");
    rmSync(dir, { recursive: true, force: true });
  });

  it("enforces the expectedHash conflict guard", async () => {
    const created = store.writeNewFile(OWNER, projectId, "brief.md", "v1");
    await rejectsCode(
      (async () => store.updateFile(OWNER, projectId, "brief.md", "v2-stale", { expectedHash: "deadbeef", actor: EMAIL }))(),
      "CONFLICT"
    );
    const updated = store.updateFile(OWNER, projectId, "brief.md", "v2", {
      expectedHash: created.hash,
      actor: EMAIL,
    });
    assert.equal(updated.content, "v2");
    // Old hash is now stale.
    rejectsCodeSync(
      () => store.updateFile(OWNER, projectId, "brief.md", "v3-stale", { expectedHash: created.hash, actor: EMAIL }),
      "CONFLICT"
    );
    rmSync(dir, { recursive: true, force: true });
  });

  it("snapshots versions and restores them (undoably)", async () => {
    const v1 = store.writeNewFile(OWNER, projectId, "notes.md", "one");
    const v2 = store.updateFile(OWNER, projectId, "notes.md", "two", {
      expectedHash: v1.hash,
      actor: EMAIL,
    });
    const versions = store.listVersions(OWNER, projectId, "notes.md");
    assert.equal(versions.length, 1);
    assert.equal(versions[0]?.source, "user-edit");
    const restored = store.restoreVersion(OWNER, projectId, "notes.md", versions[0]!.id, {
      expectedHash: v2.hash,
      actor: EMAIL,
    });
    assert.equal(restored.content, "one");
    // Restore snapshot the "two" content, so it can be restored again.
    assert.equal(store.listVersions(OWNER, projectId, "notes.md").length, 2);
    rmSync(dir, { recursive: true, force: true });
  });

  it("moves/renames and deletes with guards", () => {
    store.writeNewFile(OWNER, projectId, "a.md", "a");
    store.createFolder(OWNER, projectId, "folder");
    const moved = store.move(OWNER, projectId, "a.md", "folder", "b.md");
    assert.equal(moved.path, "folder/b.md");
    rejectsCodeSync(() => store.delete(OWNER, projectId, "folder"), "NOT_EMPTY");
    store.delete(OWNER, projectId, "folder/b.md");
    store.delete(OWNER, projectId, "folder");
    rejectsCodeSync(() => store.move(OWNER, projectId, "missing.md", ""), "NOT_FOUND");
    rmSync(dir, { recursive: true, force: true });
  });

  it("refuses to edit non-text files as text", async () => {
    store.saveUpload(OWNER, projectId, "photo.png", Buffer.from([1, 2, 3]), EMAIL);
    const read = await store.readFile(OWNER, projectId, "photo.png");
    assert.equal(read.editable, false);
    assert.equal(read.content, "");
    rejectsCodeSync(
      () => store.updateFile(OWNER, projectId, "photo.png", "x", { expectedHash: read.hash, actor: EMAIL }),
      "NOT_EDITABLE"
    );
    rmSync(dir, { recursive: true, force: true });
  });

  it("searches filenames and content", async () => {
    store.writeNewFile(OWNER, projectId, "icp.md", "Our buyer is a VP of Sales\nat mid-market firms.");
    store.writeNewFile(OWNER, projectId, "other.md", "Nothing relevant.");
    const hits = await store.search(OWNER, projectId, "vp of sales");
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.path, "icp.md");
    assert.equal(hits[0]?.line, 1);
    const nameHits = await store.search(OWNER, projectId, "icp");
    assert.ok(nameHits.some((h) => h.line === 0 && h.path === "icp.md"));
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("ProjectStore proposals", () => {
  let dir = "";
  let store: ProjectStore;
  let projectId = "";
  beforeEach(() => {
    const fresh = freshStore();
    dir = fresh.dir;
    store = fresh.store;
    projectId = store.createProject(OWNER, EMAIL, "P").id;
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("accept applies the change, reject leaves the file untouched", async () => {
    const created = store.writeNewFile(OWNER, projectId, "brief.md", "original");
    const edit = store.createProposal(OWNER, projectId, {
      op: "edit",
      path: "brief.md",
      summary: "Improve the brief",
      content: "improved",
      createdBy: "assistant",
    });
    // Nothing applied yet.
    assert.equal((await store.readFile(OWNER, projectId, "brief.md")).content, "original");
    store.rejectProposal(OWNER, projectId, edit.id);
    assert.equal((await store.readFile(OWNER, projectId, "brief.md")).content, "original");

    const edit2 = store.createProposal(OWNER, projectId, {
      op: "edit",
      path: "brief.md",
      summary: "Improve the brief",
      content: "improved",
      createdBy: "assistant",
    });
    void created;
    const accepted = store.acceptProposal(OWNER, projectId, edit2.id, EMAIL);
    assert.equal(accepted.file.content, "improved");
    assert.equal(accepted.proposal.status, "accepted");
  });

  it("rejects stale proposals instead of overwriting", () => {
    const created = store.writeNewFile(OWNER, projectId, "doc.md", "v1");
    const proposal = store.createProposal(OWNER, projectId, {
      op: "edit",
      path: "doc.md",
      summary: "change",
      content: "proposed",
      createdBy: "assistant",
    });
    // Someone else edits first.
    store.updateFile(OWNER, projectId, "doc.md", "v2-user", {
      expectedHash: created.hash,
      actor: EMAIL,
    });
    rejectsCodeSync(() => store.acceptProposal(OWNER, projectId, proposal.id, EMAIL), "CONFLICT");
    const listed = store.listProposals(OWNER, projectId);
    assert.equal(listed.find((p) => p.id === proposal.id)?.status, "stale");
  });

  it("creates new files through proposals", async () => {
    const proposal = store.createProposal(OWNER, projectId, {
      op: "create",
      path: "checklist.md",
      summary: "New checklist",
      content: "# Checklist",
      createdBy: "assistant",
    });
    const { file } = store.acceptProposal(OWNER, projectId, proposal.id, EMAIL);
    assert.equal(file.content, "# Checklist");
    assert.equal((await store.readFile(OWNER, projectId, "checklist.md")).content, "# Checklist");
  });
});
