import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  InvalidPathError,
  basenameOf,
  dirnameOf,
  extensionOf,
  joinProjectPath,
  normalizeName,
  normalizeProjectPath,
} from "../paths.js";

function rejectsInvalid(fn: () => unknown) {
  assert.throws(fn, (err: unknown) => err instanceof InvalidPathError);
}

describe("normalizeProjectPath", () => {
  it("accepts normal relative paths", () => {
    assert.equal(normalizeProjectPath("brief.md"), "brief.md");
    assert.equal(normalizeProjectPath("docs/icp.md"), "docs/icp.md");
    assert.equal(normalizeProjectPath("/docs/icp.md"), "docs/icp.md");
    assert.equal(normalizeProjectPath("docs//icp.md"), "docs/icp.md");
    assert.equal(normalizeProjectPath("./docs/icp.md"), "docs/icp.md");
  });

  it("normalizes the root", () => {
    assert.equal(normalizeProjectPath(""), "");
    assert.equal(normalizeProjectPath("/"), "");
    assert.equal(normalizeProjectPath("."), "");
    assert.equal(normalizeProjectPath("  "), "");
  });

  it("rejects traversal attempts", () => {
    rejectsInvalid(() => normalizeProjectPath(".."));
    rejectsInvalid(() => normalizeProjectPath("../secrets"));
    rejectsInvalid(() => normalizeProjectPath("docs/../../etc/passwd"));
    rejectsInvalid(() => normalizeProjectPath("docs/..\\..\\x"));
    rejectsInvalid(() => normalizeProjectPath("..\\windows\\path"));
  });

  it("rejects the system dir", () => {
    rejectsInvalid(() => normalizeProjectPath(".workspace"));
    rejectsInvalid(() => normalizeProjectPath(".workspace/versions/x"));
    rejectsInvalid(() => normalizeProjectPath("docs/.workspace"));
  });

  it("rejects control characters and oversized paths", () => {
    rejectsInvalid(() => normalizeProjectPath("a" + String.fromCharCode(0) + "b"));
    rejectsInvalid(() => normalizeProjectPath("a".repeat(600)));
    assert.equal(normalizeProjectPath("ok"), "ok");
  });
});

describe("normalizeName", () => {
  it("accepts plain names", () => {
    assert.equal(normalizeName("brief.md"), "brief.md");
    assert.equal(normalizeName("  spaced  "), "spaced");
  });

  it("rejects separators and reserved names", () => {
    rejectsInvalid(() => normalizeName(""));
    rejectsInvalid(() => normalizeName(".."));
    rejectsInvalid(() => normalizeName("a/b"));
    rejectsInvalid(() => normalizeName("a\\b"));
    rejectsInvalid(() => normalizeName(".workspace"));
  });
});

describe("path helpers", () => {
  it("joins dir + name", () => {
    assert.equal(joinProjectPath("", "a.md"), "a.md");
    assert.equal(joinProjectPath("docs", "a.md"), "docs/a.md");
    rejectsInvalid(() => joinProjectPath("docs", "../x"));
  });

  it("splits dirname/basename/extension", () => {
    assert.equal(dirnameOf("docs/a.md"), "docs");
    assert.equal(dirnameOf("a.md"), "");
    assert.equal(basenameOf("docs/a.md"), "a.md");
    assert.equal(extensionOf("docs/A.MD"), "md");
    assert.equal(extensionOf("noext"), "");
  });
});
