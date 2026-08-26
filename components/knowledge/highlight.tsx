function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "else", "of", "to", "in",
  "on", "at", "by", "for", "with", "is", "are", "was", "were", "be", "been",
  "being", "do", "does", "did", "has", "have", "had", "i", "you", "he", "she",
  "it", "we", "they", "this", "that", "these", "those", "my", "your", "our",
  "their", "where", "when", "what", "which", "who", "how", "why", "can", "could",
  "should", "would", "will", "may", "might", "about", "from", "as", "into",
  "than", "out", "up", "down", "me", "him", "her", "us", "them",
]);

// Derives the set of terms worth highlighting from a query: the full phrase
// (so exact short queries still match) plus each significant word (so a long
// natural-language chat message still highlights the words that actually hit).
function extractTerms(query: string): string[] {
  const q = query.trim();
  if (!q) return [];
  const terms = new Set<string>([q]);
  for (const raw of q.split(/\s+/)) {
    const trimmed = raw.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
    if (trimmed.length >= 3 && !STOPWORDS.has(trimmed.toLowerCase())) {
      terms.add(trimmed);
    }
  }
  return [...terms];
}

// Renders `text` with every case-insensitive occurrence of the query (or its
// significant words) wrapped in <mark>. Plain React text nodes only — no
// dangerouslySetInnerHTML — so this is safe against XSS by construction.
export function Highlight({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  const terms = extractTerms(query);
  if (terms.length === 0) return <>{text}</>;

  const pattern = terms
    .slice()
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");

  const parts = text.split(new RegExp(`(${pattern})`, "gi"));
  const lowerTerms = terms.map((t) => t.toLowerCase());

  return (
    <>
      {parts.map((part, i) =>
        part && lowerTerms.includes(part.toLowerCase()) ? (
          <mark
            key={i}
            className="rounded-sm bg-yellow-300/60 px-0.5 text-inherit dark:bg-yellow-500/40"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
