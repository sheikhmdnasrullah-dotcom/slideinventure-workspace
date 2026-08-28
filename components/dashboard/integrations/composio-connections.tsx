"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CONNECTABLE_TOOLKITS } from "@/lib/integrations/composio-toolkits";

type Conn = { id: string; app: string; status: string };

export function ComposioConnections() {
  const [conns, setConns] = useState<Conn[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);

  const load = () => {
    fetch("/api/integrations/composio", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setConns(d.connections ?? []))
      .catch(() => setConns([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const connect = async (toolkit: string) => {
    setConnecting(toolkit);
    try {
      const res = await fetch("/api/integrations/composio/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolkit }),
      });
      const json = await res.json();
      if (!res.ok || !json.redirectUrl) throw new Error(json.error || "Could not start the connection");
      window.open(json.redirectUrl, "_blank", "noopener,noreferrer");
      toast.info("Finish connecting in the new tab, then come back and refresh.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start the connection");
    } finally {
      setConnecting(null);
    }
  };

  if (loading) return <p className="text-sm text-foreground/40">Loading Composio</p>;
  if (conns === null) return <p className="text-sm text-foreground/40">Composio not configured.</p>;

  const connectedApps = new Set(conns.filter((c) => c.status === "ACTIVE" || c.status === "active").map((c) => c.app.toLowerCase()));

  return (
    <div className="flex flex-col gap-3">
      {conns.length === 0 ? (
        <p className="text-sm text-foreground/40">No apps connected yet — connect one below.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {conns.map((c) => (
            <span key={c.id} className="rounded-full border border-rule px-3 py-1 text-xs">
              {c.app} · {c.status}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {CONNECTABLE_TOOLKITS.filter((t) => !connectedApps.has(t.slug)).map((t) => (
          <Button
            key={t.slug}
            size="xs"
            variant="outline"
            disabled={connecting === t.slug}
            onClick={() => connect(t.slug)}
          >
            {connecting === t.slug && <Loader2 className="size-3 animate-spin" />}
            Connect {t.name}
          </Button>
        ))}
        <Button size="xs" variant="ghost" onClick={load}>
          Refresh
        </Button>
      </div>
    </div>
  );
}
