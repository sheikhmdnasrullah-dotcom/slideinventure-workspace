#!/usr/bin/env tsx
import { runCommand } from "../lib/tasks/runner";

const command = process.argv[2];
if (!command) {
  console.log("Usage: npm run task <command> [args...]");
  process.exit(1);
}

const args = process.argv.slice(3);
runCommand(command, args, { task_type: "script" }).then(
  () => {
    console.log("Task completed");
    process.exit(0);
  },
  (err) => {
    console.error("Task failed:", err);
    process.exit(1);
  }
);
