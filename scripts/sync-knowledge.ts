#!/usr/bin/env tsx
import { syncKnowledge } from "../lib/knowledge/sync";

async function main() {
  const count = await syncKnowledge(); 
  const result = { success: true, output: count };
  console.log(result.output);
  process.exit(result.success ? 0 : 1);
}

main();
