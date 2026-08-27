import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { databases } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { Badge } from "@/components/ui/badge";
import { HighlightedBody } from "@/components/knowledge/highlighted-body";

const DB = APPWRITE.databaseId;
const COL = APPWRITE.collections.knowledgeItems;

export default async function KnowledgeItemPage(
  props: PageProps<"/knowledge/[slug]">
) {
  await requireUser();
  const { slug } = await props.params;
  const searchParams = await props.searchParams;
  const q = typeof searchParams.q === "string" ? searchParams.q : undefined;
  const chunkParam = typeof searchParams.chunk === "string" ? Number(searchParams.chunk) : undefined;
  const chunk = chunkParam !== undefined && Number.isFinite(chunkParam) ? chunkParam : undefined;

  // Resolve the resource by slug first, then by internal $id. Search results
  // and evidence links may reference either identifier, so accepting both keeps
  // a deep link from ever hard-failing with a "Not Found" page.
  const bySlug = await databases.listDocuments(DB, COL, [Query.equal("slug", slug)]);
  let doc = bySlug.documents[0];
  if (!doc) {
    const byId = await databases.listDocuments(DB, COL, [Query.equal("$id", slug)]);
    doc = byId.documents[0];
  }

  if (!doc) {
    return (
      <div className="flex flex-1 flex-col items-start gap-4 p-6">
        <Link href="/knowledge" className="text-xs text-foreground/40 hover:underline">
          ← Knowledge Base
        </Link>
        <div className="flex flex-col gap-2 rounded-lg border border-dashed p-6">
          <h1 className="text-lg font-medium">This source is no longer available</h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            The knowledge source referenced by this link could not be found. It may have been
            deleted or moved. Your other data and the rest of the dashboard are unaffected.
          </p>
          <Link
            href="/chat"
            className="text-sm text-primary hover:underline"
          >
            Back to search results
          </Link>
        </div>
      </div>
    );
  }

  const item = {
    id: doc.$id,
    slug: doc.slug,
    type: doc.type,
    title: doc.title,
    status: doc.status,
    source: doc.source,
    author: doc.author,
    tags: Array.isArray(doc.tags) ? doc.tags : doc.tags ? JSON.parse(doc.tags as string) : [],
    body: doc.body,
    updated_at: doc.updated_at,
  };

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
