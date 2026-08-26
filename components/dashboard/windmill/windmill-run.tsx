"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function WindmillRun() {
  const [path, setPath] = useState("");
  const [running, setRunning] = useState(false);
  const [out, setOut] = useState<string>("");

  async function run() {
    if (!path.trim() || running) return;
    setRunning(true);
    setOut("");
    try {
      const res = await fetch("/api/windmill/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: path.trim() }),
      });
      const data = await res.json();
      setOut(JSON.stringify(data, null, 1).slice(0, 500));
    } catch (e) {
      setOut(e instanceof Error ? e.message : "failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="Windmill script/flow path (e.g. u/user/run_agent)"
          className="max-w-md"
          disabled={running}
        />
        <Button onClick={run} disabled={running || !path.trim()}>
          {running ? "Running…" : "Run on Windmill"}
        </Button>
      </div>
      <p className="text-xs text-foreground/40">
        Optional orchestration via a self-hosted Windmill instance (set WINDMILL_API_URL + WINDMILL_TOKEN).
        Falls back to the built-in task runner when unconfigured.
      </p>
      {out && <pre className="max-h-40 overflow-auto rounded-md bg-[var(--surface-2)] p-2 text-xs">{out}</pre>}
    </div>
  );
}
