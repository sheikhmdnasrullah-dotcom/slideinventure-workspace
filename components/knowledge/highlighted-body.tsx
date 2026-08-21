"use client";

import { useEffect } from "react";
import { chunkBody } from "@/lib/knowledge/chunking";
import { Highlight } from "@/components/knowledge/highlight";

export function HighlightedBody({
  body,
  query,
  chunk,
}: {
  body: string;
  query?: string;
  chunk?: number;
}) {
  const chunks = chunkBody(body);

  useEffect(() => {
    if (chunk === undefined && !query) return;
    const target =
      chunk !== undefined ? document.getElementById(`chunk-${chunk}`) : document.querySelector("mark");
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [chunk, query]);

  if (chunks.length === 0) {
    return <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">{body}</div>;
  }

  return (
    <div className="flex flex-col gap-4 text-sm leading-relaxed text-foreground/80">
      {chunks.map((c) => (
        <p key={c.chunkIndex} id={`chunk-${c.chunkIndex}`} className="scroll-mt-24 whitespace-pre-wrap">
          {query ? <Highlight text={c.text} query={query} /> : c.text}
        </p>
      ))}
    </div>
  );
}
