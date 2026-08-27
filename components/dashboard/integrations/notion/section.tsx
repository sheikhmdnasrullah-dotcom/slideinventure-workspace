"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

type Integration = {
  id: string;
  name: string;
  provider: string;
  status: string;
};

async function loadNotionIntegration(): Promise<Integration | null> {
  const res = await fetch("/api/integrations?provider=notion&pageSize=10", {
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = await res.json();
  const items: Integration[] = json.data ?? [];
  return (
    items.find((i) => i.status === "active" || i.status === "needs_reauth") ?? null
  );
}

export default function NotionSection() {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const integration = await loadNotionIntegration();
        if (integration) {
          setConnected(true);
          setWorkspaceName(integration.name || "Notion");
        }
      } catch {
        // keep disconnected
      } finally {
        setLoading(false);
      }
    };
    checkConnection();
  }, []);

  const handleConnect = () => {
    router.replace("/dashboard?notion_connect=start");
  };

  const handleDisconnect = async () => {
    try {
      const integration = await loadNotionIntegration();
      if (!integration) return;
      const res = await fetch(`/api/integrations/${integration.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("delete failed");
      setConnected(false);
      setWorkspaceName("");
      toast.success("Notion disconnected");
    } catch {
      toast.error("Failed to disconnect");
    }
  };

  if (loading) {
    return <span className="text-xs text-muted-foreground">Notion</span>;
  }

  if (connected) {
    return (
      <div className="flex items-center gap-3">
        <span className="font-medium text-foreground">{workspaceName}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDisconnect}
          className="p-1"
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="icon"
        onClick={handleConnect}
        title="Connect Notion"
      >
        <Settings className="size-4" />
      </Button>
      <span className="text-xs text-muted-foreground">Notion</span>
    </div>
  );
}
