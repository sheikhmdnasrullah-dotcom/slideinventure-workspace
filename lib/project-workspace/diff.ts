/**
 * Minimal line diff (LCS over hashed lines) shared by the server and the
 * proposal-review UI. No dependencies; operates on lines only.
 */

export type DiffOp =
  | { type: "same"; oldLine: number; newLine: number; text: string }
  | { type: "add"; newLine: number; text: string }
  | { type: "remove"; oldLine: number; text: string };

export type DiffSummary = { added: number; removed: number };

function hashLine(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function diffLines(oldText: string, newText: string): DiffOp[] {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  const ha = a.map(hashLine);
  const hb = b.map(hashLine);
  const n = a.length;
  const m = b.length;

  // Cap the DP table: very large files fall back to whole-file replace view.
  if (n * m > 4_000_000) {
    const ops: DiffOp[] = [];
    a.forEach((text, i) => ops.push({ type: "remove", oldLine: i + 1, text }));
    b.forEach((text, i) => ops.push({ type: "add", newLine: i + 1, text }));
    return ops;
  }

  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    const row = dp[i]!;
    const next = dp[i + 1]!;
    for (let j = m - 1; j >= 0; j--) {
      row[j] = ha[i] === hb[j] && a[i] === b[j] ? next[j + 1] + 1 : Math.max(next[j], row[j + 1]!);
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (ha[i] === hb[j] && a[i] === b[j]) {
      ops.push({ type: "same", oldLine: i + 1, newLine: j + 1, text: a[i]! });
      i++;
      j++;
    } else if (dp[i + 1]![j] >= dp[i]![j + 1]!) {
      ops.push({ type: "remove", oldLine: i + 1, text: a[i]! });
      i++;
    } else {
      ops.push({ type: "add", newLine: j + 1, text: b[j]! });
      j++;
    }
  }
  while (i < n) {
    ops.push({ type: "remove", oldLine: i + 1, text: a[i]! });
    i++;
  }
  while (j < m) {
    ops.push({ type: "add", newLine: j + 1, text: b[j]! });
    j++;
  }
  return ops;
}

export function summarizeDiff(ops: DiffOp[]): DiffSummary {
  let added = 0;
  let removed = 0;
  for (const op of ops) {
    if (op.type === "add") added++;
    else if (op.type === "remove") removed++;
  }
  return { added, removed };
}
