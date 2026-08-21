import { spawn } from "node:child_process";
import { startTaskRun, completeTaskRun, failTaskRun, type TaskType } from "./logger";

// Spawns `command`, captures stdout/stderr, and records the result onto an
// already-started task_runs row. Shared by the CLI runner and the API
// execute route so both use the same capture/truncation logic.
export async function execAndRecord(runId: string, command: string, cwd?: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, { cwd, shell: true });
    const stdout: string[] = [];
    const stderr: string[] = [];

    child.stdout.on("data", (data) => stdout.push(data.toString()));
    child.stderr.on("data", (data) => stderr.push(data.toString()));

    child.on("close", async (code) => {
      const output = [
        ...stdout,
        ...(stderr.length > 0 ? ["STDERR:", ...stderr] : []),
      ]
        .join("")
        .slice(0, 50000);

      try {
        await completeTaskRun(runId, output, code ?? 0);
        resolve();
      } catch (err) {
        reject(err);
      }
    });

    child.on("error", async (err) => {
      try {
        await failTaskRun(runId, err.message);
        reject(err);
      } catch (rejectErr) {
        reject(rejectErr);
      }
    });
  });
}

export async function runCommand(command: string, args: string[] = [], options: { task_type?: TaskType; cwd?: string } = {}) {
  const fullCommand = `${command} ${args.join(" ")}`.trim();
  const runId = await startTaskRun({
    task_type: options.task_type ?? "script",
    command: fullCommand,
  });

  return execAndRecord(runId, fullCommand, options.cwd);
}
