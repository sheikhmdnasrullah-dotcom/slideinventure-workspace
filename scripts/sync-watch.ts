#!/usr/bin/env tsx
import { watch } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");
const VAULT_DIR = path.join(process.cwd(), "SecondBrain");

let timeout: NodeJS.Timeout | null = null;

async function runSync() {
  try {
    console.log(`[${new Date().toLocaleTimeString()}] Syncing...`);
    execSync("npm run sync", { cwd: process.cwd(), stdio: "inherit" });
  } catch (error) {
    console.error("Sync failed:", error);
  }
}

async function watchDir() {
  console.log("Watching for changes in knowledge/ and SecondBrain/...");
  console.log("Press Ctrl+C to stop\n");

  await runSync();

  const dirs = [KNOWLEDGE_DIR, VAULT_DIR];
  
  for (const dir of dirs) {
    try {
      await fs.access(dir);
      watch(dir, { recursive: true }, () => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(async () => {
          await runSync();
        }, 1000);
      });
    } catch {
      // Directory doesn't exist, skip
    }
  }
}

watchDir().catch(console.error);
