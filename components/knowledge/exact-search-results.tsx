import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Highlight } from "@/components/knowledge/highlight";
import { Sparkles } from "lucide-react";

export type ChunkHit = {
  id: string;
  knowledge_item_id: string;
  chunk_index: number;
  heading: string | null;
  text: string;
  start_offset: number;
  end_offset: number;
  knowledge_items: {
    slug: string;
    title: string;
    type: string;
    source: string;
    status: string;
    updated_at: string;
  } | null;
};

export function ExactSearchResults({
  query,
  total,
  page,
  pageSize,
  results,
  onPageChange,
  onAskAI,
}: {
  query: string;
  total: number;
  page: number;
  pageSize: number;
  results: ChunkHit[];
  onPageChange: (page: number) => void;
  onAskAI?: (hit: ChunkHit) => void;
}) {
  if (results.length === 0) {
    return <p className="text-sm text-muted-foreground">No matches for &ldquo;{query}&rdquo;.</p>;
  }

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const hasPrev = page > 1;
  const hasNext = to < total;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-foreground/40">
        {total} match{total === 1 ? "" : "es"}, showing {from}–{to}
      </p>

      <div className="flex flex-col gap-2">
        {results.map((hit) => {
          const item = hit.knowledge_items;
          return (
            <Card key={hit.id}>
              <CardContent className="flex flex-col gap-2 p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-brand/30 bg-brand-soft text-signal">
                    {item?.type ?? "unknown"}
                  </Badge>
                  <span className="text-xs text-foreground/40">{item?.status}</span>
                  {hit.heading && (
                    <span className="truncate text-xs text-foreground/40">{hit.heading}</span>
                  )}
                </div>
                <p className="text-sm leading-relaxed text-foreground/80">
                  <Highlight text={hit.text} query={query} />
                </p>
                <div className="flex items-center justify-between">
                  <span className="truncate text-xs text-foreground/40">{item?.source}</span>
                  <div className="flex items-center gap-2">
                    {item && (
                      <Link
                        href={`/knowledge/${item.slug}?q=${encodeURIComponent(query)}&chunk=${hit.chunk_index}`}
                        className="text-xs text-signal hover:underline"
                      >
                        Open source →
                      </Link>
                    )}
                    {onAskAI && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs gap-1"
                        onClick={() => onAskAI(hit)}
                      >
                        <Sparkles className="size-3" />
                        Ask AI
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {(hasPrev || hasNext) && (
        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={!hasPrev}
            className="text-foreground/60 hover:underline disabled:opacity-30"
          >
            ← Previous
          </button>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={!hasNext}
            className="text-foreground/60 hover:underline disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
