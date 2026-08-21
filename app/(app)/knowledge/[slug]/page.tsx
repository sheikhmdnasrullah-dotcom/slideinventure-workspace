import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, createServiceClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { HighlightedBody } from "@/components/knowledge/highlighted-body";

export default async function KnowledgeItemPage(
  props: PageProps<"/knowledge/[slug]">
) {
  await requireUser();
  const { slug } = await props.params;
  const searchParams = await props.searchParams;
  const q = typeof searchParams.q === "string" ? searchParams.q : undefined;
  const chunkParam = typeof searchParams.chunk === "string" ? Number(searchParams.chunk) : undefined;
  const chunk = chunkParam !== undefined && Number.isFinite(chunkParam) ? chunkParam : undefined;

  const supabase = createServiceClient();
  const { data: item } = await supabase
    .from("knowledge_items")
    .select("id, slug, type, title, status, source, author, tags, body, updated_at")
    .eq("slug", slug)
    .maybeSingle();

  if (!item) {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <Link href="/knowledge" className="text-xs text-foreground/40 hover:underline">
        ← Knowledge Base
      </Link>

      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-medium">{item.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-brand/30 bg-brand-soft text-signal">
            {item.type}
          </Badge>
          <span className="text-xs text-foreground/40">{item.status}</span>
          {item.tags?.map((tag: string) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-foreground/40">
          Source: {item.source} · Author: {item.author} · Updated{" "}
          {new Date(item.updated_at).toLocaleDateString()}
        </p>
      </div>

      <HighlightedBody body={item.body} query={q} chunk={chunk} />
    </div>
  );
}
