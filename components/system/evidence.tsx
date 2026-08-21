"use client";

import Link from "next/link";
import { Highlight } from "@/components/knowledge/highlight";
import { cn } from "@/lib/utils";

/**
 * Evidence primitives — the brief's central "search results as evidence"
 * requirement. Two components:
 *
 *   SourceCitation  the small reference strip below an answer/result: a type
 *                  badge, a source slug, an optional position coordinate, and
 *                  an "Open source →" deep link. Used under chat answers and
 *                  inline in the search result list.
 *
 *   EvidenceBlock   the larger unit: the highlighted passage text (with the
 *                  query highlighted at exact offsets) + the SourceCitation
 *                  strip below. An evidence-first search result card or a
 *                  chat citation — the SAME shape, intentionally, so the two
 *                  surfaces (search + chat) read as one evidence system.
 *
 * Both consume knowledge_chunks' offsets and the /knowledge/[slug]?q=&chunk=
 * deep link the existing search already builds. This is the unified evidence
 * renderer the audit proposed (Phase E) — here in primitive form so Phase E
 * can compose it without re-building the chrome.
 */

export function SourceCitation({
  type,
  source,
  position,
  href,
  className,
}: {
  type?: string;
  source?: React.ReactNode;
  position?: React.ReactNode;
  href?: string;
  className?: string;
}) {
  return (
    <div
      data-slot="source-citation"
      className={cn(
        "flex flex-wrap items-center gap-2 font-label text-ink-faint",
        className
      )}
    >
      {type && (
        <span className="rounded-xs bg-[var(--accent-wash)] px-1.5 py-0.5 text-[var(--text-accent)]">
          {type}
        </span>
      )}
      {source && <span className="truncate normal-case">{source}</span>}
      {position && (
        <span className="tabular-nums normal-case">· {position}</span>
      )}
      {href && (
        <Link
          href={href}
          className="normal-case text-ink-muted transition-colors hover:text-[var(--text-accent)]"
        >
          Open source →
        </Link>
      )}
    </div>
  );
}

export function EvidenceBlock({
  query,
  text,
  type,
  source,
  position,
  href,
  className,
}: {
  query?: string;
  text: string;
  type?: string;
  source?: React.ReactNode;
  position?: React.ReactNode;
  href?: string;
  className?: string;
}) {
  return (
    <div
      data-slot="evidence-block"
      className={cn(
        "flex flex-col gap-2 border-l border-rule pl-3",
        className
      )}
    >
      <p className="font-body text-sm leading-relaxed text-ink-default">
        {query ? <Highlight text={text} query={query} /> : text}
      </p>
      <SourceCitation type={type} source={source} position={position} href={href} />
    </div>
  );
}
