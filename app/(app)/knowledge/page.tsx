import Link from "next/link";
import { requireUser, createServiceClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { KnowledgeSearchPanel } from "@/components/knowledge/search-panel";

type KnowledgeItem = {
  id: string;
  slug: string;
  type: string;
  title: string;
  status: string;
  source: string;
  updated_at: string;
};

export default async function KnowledgePage() {
  await requireUser();

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("knowledge_items")
    .select("id, slug, type, title, status, source, updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);

  const items = (data ?? []) as KnowledgeItem[];

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-sm font-medium tracking-wide text-foreground/60 uppercase">
          Knowledge Base
        </h1>
        <p className="text-xs text-foreground/40">
          {items.length} {items.length === 1 ? "item" : "items"}
        </p>
      </div>

      <KnowledgeSearchPanel initialItems={items} />
    </div>
  );
}
