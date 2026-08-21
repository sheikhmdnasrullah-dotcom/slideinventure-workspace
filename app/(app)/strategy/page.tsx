import { requireUser, createServiceClient } from "@/lib/supabase/server";
import { createCard } from "./actions";
import { StrategyBoard, type StrategyCard } from "./board";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function StrategyPage() {
  await requireUser();

  // ponytail: same RLS gap as the knowledge pages — service role, page is
  // already gated by requireUser().
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("knowledge_items")
    .select("id, slug, type, title, status, source, updated_at")
    .in("type", ["decision", "plan"])
    .order("updated_at", { ascending: false });

  const cards = (data ?? []) as StrategyCard[];

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-sm font-medium tracking-wide text-foreground/60 uppercase">
          Strategy
        </h1>
        <span className="text-xs text-foreground/40 tabular-nums">
          {cards.length} {cards.length === 1 ? "card" : "cards"}
        </span>
      </div>

      <Card>
        <CardContent>
          <form action={createCard} className="flex flex-wrap items-end gap-3 text-sm">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-foreground/40">Title</label>
              <input
                type="text"
                name="title"
                required
                className="border-b border-foreground/15 bg-transparent py-1 outline-none focus:border-signal"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-foreground/40">Type</label>
              <select
                name="type"
                defaultValue="decision"
                className="border-b border-foreground/15 bg-transparent py-1 outline-none focus:border-signal"
              >
                <option value="decision">decision</option>
                <option value="plan">plan</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-foreground/40">Source</label>
              <input
                type="text"
                name="source"
                placeholder="Strategy board"
                className="border-b border-foreground/15 bg-transparent py-1 outline-none focus:border-signal"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-foreground/40">Notes</label>
              <input
                type="text"
                name="body"
                className="border-b border-foreground/15 bg-transparent py-1 outline-none focus:border-signal"
              />
            </div>
            <Button type="submit" className="bg-brand text-white hover:bg-brand/85">
              Add card
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-foreground/60">
          Couldn&apos;t load cards: {error.message}
        </p>
      )}

      {!error && <StrategyBoard initialCards={cards} />}
    </div>
  );
}
