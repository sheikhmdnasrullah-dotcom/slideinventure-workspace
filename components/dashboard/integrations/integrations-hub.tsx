"use client";

import { useState } from "react";
import { PageHeader, Section, Surface, StatusBadge, type StatusTone } from "@/components/system";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { WindmillRun } from "@/components/dashboard/windmill/windmill-run";
import { ComposioConnections } from "@/components/dashboard/integrations/composio-connections";
import type { IntegrationStatus, IntegrationGroup } from "@/lib/integrations/status";

const GROUP_ORDER: IntegrationGroup[] = ["Agent surfaces", "Connected services"];

function toneFor(enabled: boolean): StatusTone {
  return enabled ? "live" : "neutral";
}

function TemporalControl() {
  const [task, setTask] = useState("");
  const [startUrl, setStartUrl] = useState("");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);

  async function start() {
    if (!task.trim() || busy) return;
    setBusy(true);
    setOut("");
    try {
      const res = await fetch("/api/temporal/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task, startUrl: startUrl || undefined }),
      });
      setOut(JSON.stringify(await res.json(), null, 1).slice(0, 500));
    } catch (e) {
      setOut(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={task}
        onChange={(e) => setTask(e.target.value)}
        placeholder="Agent task to run as a durable workflow…"
        className="min-h-20 text-xs"
      />
      <Input
        value={startUrl}
        onChange={(e) => setStartUrl(e.target.value)}
        placeholder="Optional start URL"
        className="text-xs"
      />
      <Button onClick={start} disabled={busy || !task.trim()} size="sm">
        {busy ? "Starting…" : "Start workflow"}
      </Button>
      {out && <pre className="max-h-40 overflow-auto rounded-md bg-[var(--surface-2)] p-2 text-xs">{out}</pre>}
    </div>
  );
}

function NovuControl() {
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true);
    setOut("");
    try {
      const res = await fetch("/api/notifications/test", { method: "POST" });
      setOut(JSON.stringify(await res.json(), null, 1).slice(0, 500));
    } catch (e) {
      setOut(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <Button onClick={send} disabled={busy} size="sm">
        {busy ? "Sending…" : "Send test notification"}
      </Button>
      {out && <pre className="max-h-32 overflow-auto rounded-md bg-[var(--surface-2)] p-2 text-xs">{out}</pre>}
    </div>
  );
}

function Mem0Control() {
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  async function test() {
    setBusy(true);
    setOut("");
    try {
      const res = await fetch("/api/memory/test", { method: "POST" });
      setOut(JSON.stringify(await res.json(), null, 1).slice(0, 500));
    } catch (e) {
      setOut(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <Button onClick={test} disabled={busy} size="sm">
        {busy ? "Testing…" : "Test remember / recall"}
      </Button>
      {out && <pre className="max-h-32 overflow-auto rounded-md bg-[var(--surface-2)] p-2 text-xs">{out}</pre>}
    </div>
  );
}

function ActionArea({ item }: { item: IntegrationStatus }) {
  switch (item.action) {
    case "link":
      return (
        <Button size="sm" variant="outline" render={<a href={item.pageHref} />}>
          Open
        </Button>
      );
    case "temporal":
      return <TemporalControl />;
    case "windmill":
      return <WindmillRun />;
    case "composio":
      return <ComposioConnections />;
    case "novu":
      return <NovuControl />;
    case "mem0":
      return <Mem0Control />;
    default:
      return (
        <p className="text-xs text-foreground/40">
          {item.enabled ? "Active — wired into the agent pipeline." : "Not configured — set its env vars to enable."}
        </p>
      );
  }
}

export function IntegrationsHub({ statuses }: { statuses: IntegrationStatus[] }) {
  return (
    <div className="flex flex-col gap-6">
      {GROUP_ORDER.map((group) => {
        const items = statuses.filter((s) => s.group === group);
        if (!items.length) return null;
        return (
          <Section key={group} tone="base">
            <PageHeader eyebrow="Integrations" title={group} />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <Surface key={item.id} variant="inset" className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{item.name}</span>
                      <span className="font-mono text-[10px] text-foreground/40">{item.repo}</span>
                    </div>
                    <StatusBadge tone={toneFor(item.enabled)} label={item.enabled ? "live" : "off"} />
                  </div>
                  <p className="text-xs text-foreground/60">{item.description}</p>
                  <div className={cn("mt-auto pt-1")}>
                    <ActionArea item={item} />
                  </div>
                </Surface>
              ))}
            </div>
          </Section>
        );
      })}
    </div>
  );
}
