"use client";

import { useEffect, useState } from "react";

type Conn = { id: string; app: string; status: string };

export function ComposioConnections() {
  const [conns, setConns] = useState<Conn[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/integrations/composio", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setConns(d.connections ?? []))
      .catch(() => setConns([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-foreground/40">Loading Composio</p>;
  if (conns === null) return <p className="text-sm text-foreground/40">Composio not configured.</p>;
  if (conns.length === 0)
    return <p className="text-sm text-foreground/40">No Composio connections yet (set COMPOSIO_API_KEY).</p>;

  return (
    <div className="flex flex-wrap gap-2">
      {conns.map((c) => (
        <span key={c.id} className="rounded-full border border-rule px-3 py-1 text-xs">
          {c.app} · {c.status}
        </span>
      ))}
    </div>
  );
}
