"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

type Entry = {
  id: string;
  content: string;
  source: string | null;
  expires_at: string;
  created_at: string;
  promoted_to_knowledge_item_id: string | null;
};

export function MemoryConsole() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [content, setContent] = useState("");
  const [source, setSource] = useState("manual");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/memory", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setEntries(data.entries ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function add() {
    if (!content.trim() || saving) return;
    setSaving(true);
    const res = await fetch("/api/memory", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content, source }),
    });
    setSaving(false);
    if (res.ok) {
      setContent("");
      toast.success("Memory saved");
      await load();
    } else {
      toast.error("Failed to save");
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/memory?id=${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-md border border-rule bg-surface p-4">
        <label className="text-xs font-medium text-foreground/60 uppercase">New memory</label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          placeholder="Anything the agent should remember this session"
        />
        <div className="flex items-center gap-2">
          <Input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="source (e.g. chat, browse, manual)"
            className="max-w-xs"
          />
          <Button onClick={add} disabled={saving || !content.trim()}>
            {saving ? "Saving" : "Add memory"}
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-foreground/40">Loading</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-foreground/40">No working memory yet.</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-3 rounded-md border border-rule bg-surface-2 p-3">
              <div className="min-w-0">
                <p className="whitespace-pre-wrap text-sm">{e.content}</p>
                <p className="mt-1 text-xs text-foreground/40">
                  {e.source} · expires {new Date(e.expires_at).toLocaleString()}
                  {e.promoted_to_knowledge_item_id && " · promoted"}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => remove(e.id)}>
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
