import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { diffLines, summarizeDiff } from "../diff.js";

describe("diffLines", () => {
  it("marks identical files as all-same", () => {
    const ops = diffLines("a\nb", "a\nb");
    assert.ok(ops.length === 2 && ops.every((o) => o.type === "same"));
    assert.deepEqual(summarizeDiff(ops), { added: 0, removed: 0 });
  });

  it("detects additions and removals", () => {
    const ops = diffLines("a\nb\nc", "a\nB\nc\nd");
    const summary = summarizeDiff(ops);
    assert.equal(summary.added, 2);
    assert.equal(summary.removed, 1);
    assert.ok(ops.some((o) => o.type === "same" && o.text === "a"));
    assert.ok(ops.some((o) => o.type === "same" && o.text === "c"));
  });

  it("handles empty old text (create)", () => {
    const ops = diffLines("", "x\ny");
    assert.deepEqual(summarizeDiff(ops), { added: 2, removed: 1 });
  });

  it("keeps line numbers consistent", () => {
    const ops = diffLines("a\nb", "a\nx\nb");
    const added = ops.find((o) => o.type === "add");
    assert.equal(added?.type === "add" ? added.newLine : -1, 2);
  });
});
