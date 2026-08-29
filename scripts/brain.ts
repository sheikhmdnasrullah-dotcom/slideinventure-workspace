#!/usr/bin/env tsx
import { watch } from "node:fs";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { spawn } from "node:child_process";

// Brain capture bridge: pushes research produced *outside* the dashboard into
// /api/brain/ingest, which classifies it and fans it out to Brain, Files,
// Notepad, or Agents. Three ways in:
//
//   brain watch                 - every save under AI Venture/workspace
//   brain run -- <command>      - a terminal command plus its output
//   brain capture [title]       - stdin, for any other AI tool
//
// Auth is the same INTERNAL_API_SECRET the other CLI/webhook callers use. The
// endpoint has no session here, so BRAIN_USER_EMAIL says who the capture is
// for; both must be set or nothing is sent (silently dropping captures would be
// worse than failing loudly).

const BASE = process.env.BRAIN_INGEST_URL || "http://localhost:3000/api/brain/ingest";
const SECRET = process.env.INTERNAL_API_SECRET || "";
const USER_EMAIL = process.env.BRAIN_USER_EMAIL || "";
const WORKSPACE_MIRROR = resolve(process.cwd(), "AI Venture/workspace");

// Only files the Brain can do something with. Skips lockfiles, build output,
// and anything binary that would just produce a garbage summary.
const CAPTURABLE = new Set([".md", ".txt", ".json", ".csv", ".tldr", ".ts", ".tsx", ".js", ".jsx", ".py", ".sh", ".sql", ".yml", ".yaml"]);
const IGNORED = /(^|\/)(node_modules|\.git|\.next|dist|build|coverage)(\/|$)|(package-lock\.json|\.DS_Store)$/;
const MAX_BYTES = 180_000;

type Payload = {
  source: "editor" | "terminal" | "external";
  title: string;
  text: string;
  path?: string | null;
  tool?: string | null;
};

function requireConfig(): void {
  const missing: string[] = [];
  if (!SECRET) missing.push("INTERNAL_API_SECRET");
  if (!USER_EMAIL) missing.push("BRAIN_USER_EMAIL");
  if (missing.length > 0) {
    console.error(`Missing ${missing.join(" and ")}. Set them in .env.local (see .env.example).`);
    process.exit(1);
  }
}

async function send(payload: Payload): Promise<void> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SECRET}`,
    },
    body: JSON.stringify({ ...payload, userEmail: USER_EMAIL }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    destinations?: string[];
    warnings?: string[];
  };

  if (!res.ok) {
    throw new Error(body.error || `Ingest failed with ${res.status}`);
  }

  const where = (body.destinations ?? []).join(", ") || "brain";
  console.log(`Captured "${payload.title}" -> ${where}`);
  for (const warning of body.warnings ?? []) console.warn(`  ! ${warning}`);
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i).toLowerCase() : "";
}

/** Reads stdin fully; returns "" when nothing is piped in. */
async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf-8");
}

/** Watches the AI Venture mirror; each debounced save becomes an editor capture. */
function watchWorkspace(): void {
  mkdirSync(WORKSPACE_MIRROR, { recursive: true });
  console.log(`Watching ${WORKSPACE_MIRROR} - saves are captured into the Brain`);
  console.log("Press Ctrl+C to stop\n");

  const debounce = new Map<string, NodeJS.Timeout>();

  const handle = (file: string) => {
    const rel = file.replace(/\\/g, "/");
    if (IGNORED.test(rel) || !CAPTURABLE.has(extOf(rel))) return;

    const abs = resolve(WORKSPACE_MIRROR, file);
    if (!existsSync(abs) || !statSync(abs).isFile()) return;

    clearTimeout(debounce.get(abs));
    // 1.5s: editors write in bursts (temp file, rename, format-on-save), and
    // each capture costs an LLM summary, so coalesce aggressively.
    debounce.set(
      abs,
      setTimeout(() => {
        debounce.delete(abs);
        try {
          if (statSync(abs).size > MAX_BYTES) {
            console.warn(`Skipped ${rel} (larger than ${MAX_BYTES} bytes)`);
            return;
          }
          const text = readFileSync(abs, "utf-8").trim();
          if (!text) return;
          send({
            source: "editor",
            title: rel.split("/").pop() || rel,
            text,
            path: relative(WORKSPACE_MIRROR, abs).replace(/\\/g, "/"),
            tool: "vscode",
          }).catch((e) => console.error(`  x ${rel}: ${e.message}`));
        } catch (e) {
          console.error(`  x ${rel}: ${e instanceof Error ? e.message : e}`);
        }
      }, 1500)
    );
  };

  watch(WORKSPACE_MIRROR, { recursive: true }, (_event, filename) => {
    if (filename) handle(filename.toString());
  });
}

/**
 * Runs a command, streams its output to the terminal as usual, and captures the
 * transcript. Exits with the command's own code so it stays usable as a wrapper
 * in scripts and CI.
 */
function runAndCapture(argv: string[]): void {
  const command = argv.join(" ");
  const child = spawn(argv[0], argv.slice(1), { stdio: ["inherit", "pipe", "pipe"] });

  let transcript = "";
  const collect = (stream: NodeJS.ReadableStream, mirror: NodeJS.WriteStream) => {
    stream.on("data", (chunk: Buffer) => {
      mirror.write(chunk);
      if (transcript.length < MAX_BYTES) transcript += chunk.toString("utf-8");
    });
  };
  collect(child.stdout, process.stdout);
  collect(child.stderr, process.stderr);

  child.on("error", (err) => {
    console.error(`Could not run "${command}": ${err.message}`);
    process.exit(1);
  });

  child.on("close", async (code) => {
    const text = `$ ${command}\nexit code: ${code ?? 0}\n\n${transcript.trim()}`;
    try {
      await send({
        source: "terminal",
        title: command.slice(0, 200),
        text,
        path: null,
        tool: "terminal",
      });
    } catch (e) {
      console.error(`Capture failed: ${e instanceof Error ? e.message : e}`);
    }
    process.exit(code ?? 0);
  });
}

async function captureStdin(title: string | undefined, tool: string): Promise<void> {
  const text = (await readStdin()).trim();
  if (!text) {
    console.error("Nothing on stdin. Pipe text in, e.g. `cat notes.md | npm run brain:capture`.");
    process.exit(1);
  }
  await send({
    source: "external",
    title: (title || text.split("\n")[0] || "Captured text").slice(0, 200),
    text: text.slice(0, MAX_BYTES),
    path: null,
    tool,
  });
}

const USAGE = `Brain capture bridge

Usage:
  tsx --env-file=.env.local scripts/brain.ts watch                 # capture every save under AI Venture/workspace
  tsx --env-file=.env.local scripts/brain.ts run -- <command>      # run a command and capture its output
  tsx --env-file=.env.local scripts/brain.ts capture [title]       # capture piped stdin from any AI tool

Environment:
  INTERNAL_API_SECRET   required, must match the dashboard's value
  BRAIN_USER_EMAIL      required, the account captures belong to
  BRAIN_INGEST_URL      optional, defaults to http://localhost:3000/api/brain/ingest
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help" || command === "--help") {
    console.log(USAGE);
    return;
  }

  requireConfig();

  switch (command) {
    case "watch":
      watchWorkspace();
      break;
    case "run": {
      // Everything after the first `--` is the command, so its own flags are
      // never parsed as ours.
      const sep = args.indexOf("--");
      const rest = sep === -1 ? args.slice(1) : args.slice(sep + 1);
      if (rest.length === 0) {
        console.error("usage: brain.ts run -- <command>");
        process.exit(1);
      }
      runAndCapture(rest);
      break;
    }
    case "capture":
    case "text":
      await captureStdin(args.slice(1).join(" ") || undefined, "stdin");
      break;
    default:
      console.log(USAGE);
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

