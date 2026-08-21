"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search, FileText } from "lucide-react";

type KnowledgeItem = {
  id: string;
  slug: string;
  type: string;
  title: string;
  status: string;
  source: string;
  updated_at: string;
  body: string;
};

export function KnowledgeSearchPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/knowledge/search?q=${encodeURIComponent(query.trim())}`, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as KnowledgeItem[];
        setResults(data);
      } else {
        toast.error("Search failed");
      }
    } catch {
      toast.error("Search failed");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (query.trim().length >= 3) {
        search();
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [query, search]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="size-4" />
          Knowledge Base Search
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Search across all synced knowledge items, SOPs, research, and system docs.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything... e.g. &quot;mail server setup&quot;, &quot;cold email benchmarks&quot;, &quot;Supabase auth flow&quot;"
            className="text-sm"
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
          <Button onClick={search} disabled={loading || !query.trim()} className="shrink-0">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            Search
          </Button>
        </div>

        {results.length > 0 && (
          <div className="flex flex-col gap-2">
            {results.map((item) => (
              <a
                key={item.id}
                href={`/knowledge/${item.slug}`}
                className="flex items-start gap-3 rounded-lg border border-foreground/10 bg-background/60 p-3 transition-colors hover:bg-background/80"
              >
                <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">{item.title}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs border-brand/30 bg-brand-soft text-signal">
                      {item.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{item.source}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  {item.body && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {item.body.slice(0, 200)}
                      {item.body.length > 200 && "..."}
                    </p>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}

        {searched && !loading && results.length === 0 && (
          <p className="text-sm text-muted-foreground">No results found.</p>
        )}
      </CardContent>
    </Card>
  );
}
