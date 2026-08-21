"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, X, Loader2 } from "lucide-react";

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

function excerpt(body: string, query: string) {
  const idx = body.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return body.slice(0, 140);
  const start = Math.max(0, idx - 40);
  return `${start > 0 ? "…" : ""}${body.slice(start, start + 160)}…`;
}

export function KnowledgeChatWidget() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/knowledge/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      if (res.ok) {
        setResults((await res.json()) as KnowledgeItem[]);
      } else {
        toast.error("Search failed");
      }
    } catch {
      toast.error("Search failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timeout = setTimeout(() => search(q), 400);
    return () => clearTimeout(timeout);
  }, [query, search]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      setSearched(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {open && (
        <div className="fixed right-6 bottom-24 z-50 flex h-[28rem] w-96 flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-medium">Knowledge search</span>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => setOpen(false)}
              aria-label="Close knowledge search"
            >
              <X className="size-3.5" />
            </Button>
          </div>

          <div className="border-b border-border p-3">
            <Input
              autoFocus
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Ask about a prospect, SOP, decision…"
              className="h-8 text-xs"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : !searched ? (
              <p className="px-1 text-xs text-muted-foreground">
                Search across research, prospects, SOPs, and decisions in the knowledge base.
              </p>
            ) : results.length === 0 ? (
              <p className="px-1 text-xs text-muted-foreground">No matching knowledge items.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {results.map((item) => (
                  <Link
                    key={item.id}
                    href={`/knowledge/${item.slug}`}
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-border p-2.5 transition-colors hover:bg-muted"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{item.title}</span>
                      <Badge variant="outline" className="border-brand/30 bg-brand-soft text-signal text-[10px]">
                        {item.type}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {excerpt(item.body ?? "", query)}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <Button
        size="icon-lg"
        onClick={() => setOpen((v) => !v)}
        className="fixed right-6 bottom-6 z-50 size-12 rounded-full shadow-lg"
        aria-label={open ? "Close knowledge search" : "Open knowledge search"}
      >
        {open ? <X className="size-5" /> : <MessageCircle className="size-5" />}
      </Button>
    </>
  );
}
