"use client"

import * as React from "react"
import { formatDistanceToNow } from "date-fns"
import type { Activity } from "@/lib/activities/client"

export function RecentList() {
  const [items, setItems] = React.useState<Activity[] | null>(null)

  React.useEffect(() => {
    fetch("/api/activities?category=ai_venture&limit=8")
      .then((res) => (res.ok ? res.json() : { activities: [] }))
      .then((data) => setItems(data.activities ?? []))
      .catch(() => setItems([]))
  }, [])

  if (items === null) {
    return (
      <div className="flex flex-col gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/20" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing yet — your activity will show up here as you work.</p>
  }

  return (
    <div className="flex flex-col gap-1">
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm hover:bg-accent/20">
          <span className="truncate">{item.title}{item.description ? ` — ${item.description}` : ""}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
          </span>
        </div>
      ))}
    </div>
  )
}
