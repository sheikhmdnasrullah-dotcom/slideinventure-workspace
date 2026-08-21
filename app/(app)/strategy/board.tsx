"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { updateCardStatus } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export type StrategyCard = {
  id: string;
  slug: string;
  type: string;
  title: string;
  status: string;
  source: string;
  updated_at: string;
};

const COLUMNS = [
  { value: "proposed", label: "Proposed" },
  { value: "in_progress", label: "In progress" },
  { value: "confirmed", label: "Confirmed" },
  { value: "deprecated", label: "Deprecated" },
];

export function StrategyBoard({ initialCards }: { initialCards: StrategyCard[] }) {
  const [cards, setCards] = useState(initialCards);
  const [, startTransition] = useTransition();

  function handleDrop(id: string, status: string) {
    if (cards.find((c) => c.id === id)?.status === status) return;
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    startTransition(() => {
      updateCardStatus(id, status).catch(() => setCards(initialCards));
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {COLUMNS.map((col) => (
        <div
          key={col.value}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const id = e.dataTransfer.getData("text/plain");
            if (id) handleDrop(id, col.value);
          }}
          className="flex flex-col gap-2 rounded-lg border border-foreground/10 p-3"
        >
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-medium tracking-wide text-foreground/60 uppercase">
              {col.label}
            </h2>
            <span className="text-xs text-foreground/30 tabular-nums">
              {cards.filter((c) => c.status === col.value).length}
            </span>
          </div>
          <div className="flex min-h-16 flex-col gap-2">
            {cards
              .filter((c) => c.status === col.value)
              .map((card) => (
                <Card
                  key={card.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", card.id)}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <CardContent className="flex flex-col gap-1 p-3">
                    <Link
                      href={`/knowledge/${card.slug}`}
                      className="text-sm hover:underline"
                    >
                      {card.title}
                    </Link>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="border-brand/30 bg-brand-soft text-signal"
                      >
                        {card.type}
                      </Badge>
                      <span className="truncate text-xs text-foreground/40">{card.source}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
