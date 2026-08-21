#!/usr/bin/env tsx
import { syncKnowledge } from "../lib/knowledge/sync";

async function main() {
  const result = await syncKnowledge(process.cwd());
  console.log(result.output);
  process.exit(result.success ? 0 : 1);
}

main();
