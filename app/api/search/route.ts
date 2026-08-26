import { getSessionUser } from "@/lib/appwrite/auth";
import { databases } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";
import { NextRequest } from "next/server";
import { searchVector, type VectorCollection } from "@/lib/retrieval/vector-index";

const DB = APPWRITE.databaseId;

type SectionDef = {
  type: string;
  collection: string;
  titleFields: string[];
  subtitleFields: string[];
  route: string;
  orderBy: string;
  label: string;
  section?: string;
};

// Global, cross-section search. We pull a recent window from each collection
// and filter by substring in code rather than relying on per-attribute fulltext
// indexes (which aren't uniformly configured) — robust and uniform across
// sections for a personal workspace.
const SECTIONS: SectionDef[] = [
  { type: "knowledge", collection: APPWRITE.collections.knowledgeItems, titleFields: ["title"], subtitleFields: ["category", "source"], route: "/knowledge", orderBy: "updated_at", label: "Knowledge" },
  { type: "leads", collection: APPWRITE.collections.leads, titleFields: ["first_name", "last_name", "email", "company"], subtitleFields: ["company", "status"], route: "/leads", orderBy: "updated_at", label: "Lead" },
  { type: "documents", collection: APPWRITE.collections.documents, titleFields: ["title", "filename"], subtitleFields: ["type"], route: "/documents", orderBy: "updated_at", label: "Document" },
  { type: "links", collection: APPWRITE.collections.usefulLinks, titleFields: ["title", "url"], subtitleFields: ["tags"], route: "/useful-links", orderBy: "created_at", label: "Link" },
  { type: "research", collection: APPWRITE.collections.affineWorkspaces, titleFields: ["title"], subtitleFields: ["section"], route: "/research-lab", orderBy: "updated_at", label: "Research", section: "research" },
  { type: "boards", collection: APPWRITE.collections.boards, titleFields: ["title"], subtitleFields: ["scope"], route: "/brainstorm-sketch", orderBy: "updated_at", label: "Board" },
  { type: "concepts", collection: APPWRITE.collections.affineWorkspaces, titleFields: ["title"], subtitleFields: ["section"], route: "/concepts", orderBy: "updated_at", label: "Concepts", section: "concepts" },
  { type: "terminal", collection: APPWRITE.collections.terminalCommands, titleFields: ["command", "description"], subtitleFields: ["category"], route: "/terminal", orderBy: "created_at", label: "Terminal" },
  { type: "todoist", collection: APPWRITE.collections.todoistTasks, titleFields: ["title", "content"], subtitleFields: ["project"], route: "/todoist", orderBy: "updated_at", label: "Todoist" },
  { type: "notes", collection: APPWRITE.collections.notes, titleFields: ["title"], subtitleFields: ["updated_at"], route: "/notepad", orderBy: "updated_at", label: "Note" },
];

function pick(doc: any, fields: string[]): string {
  for (const f of fields) {
    const v = doc[f];
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  if (q.length < 2) return Response.json({ results: [] });

  const perSection = await Promise.all(
    SECTIONS.map(async (s) => {
      try {
        const queries = [Query.orderDesc(s.orderBy), Query.limit(50)]
        if (s.section) queries.unshift(Query.equal("section", s.section))
        const res = await databases.listDocuments(DB, s.collection, queries);
        return res.documents
          .filter((d: any) => {
            const hay = s.titleFields.concat(s.subtitleFields).map((f) => d[f]).filter(Boolean).join(" ").toLowerCase();
            return hay.includes(q);
          })
          .map((d: any) => {
            const title = pick(d, s.titleFields) || "Untitled";
            const subtitle = pick(d, s.subtitleFields);
            return {
              id: d.$id,
              type: s.type,
              label: s.label,
              title,
              subtitle,
              href: `${s.route}?id=${encodeURIComponent(d.$id)}`,
              updatedAt: d[s.orderBy] ?? new Date().toISOString(),
            };
          });
      } catch {
        return [];
      }
    })
  );

  const substringResults = perSection.flat();

  // Semantic pass: catches paraphrases/typos substring matching misses (e.g.
  // a document whose title doesn't mention the term but whose body does).
  // Backed by the shared LanceDB index (lib/retrieval/vector-index.ts) —
  // scoped to the same collections substring search already covers here,
  // excluding Research Lab/AI Venture/Brainstorm/Concepts.
  const VECTOR_TYPES: VectorCollection[] = ["knowledge", "documents", "notes", "terminal", "links"];
  const seen = new Set(substringResults.map((r) => `${r.type}:${r.id}`));
  let vectorResults: typeof substringResults = [];
  try {
    const vectorHits = await searchVector(q, { collections: VECTOR_TYPES, limit: 20 });
    const newHits = vectorHits.filter((h) => !seen.has(`${h.collection}:${h.docId}`));
    const byCollection = new Map<string, string[]>();
    for (const h of newHits) {
      const list = byCollection.get(h.collection) ?? [];
      list.push(h.docId);
      byCollection.set(h.collection, list);
    }
    const fetched = await Promise.all(
      [...byCollection.entries()].map(async ([type, ids]) => {
        const s = SECTIONS.find((sec) => sec.type === type);
        if (!s) return [];
        try {
          const res = await databases.listDocuments(DB, s.collection, [Query.equal("$id", ids)]);
          return res.documents.map((d: any) => ({
            id: d.$id,
            type: s.type,
            label: s.label,
            title: pick(d, s.titleFields) || "Untitled",
            subtitle: pick(d, s.subtitleFields),
            href: `${s.route}?id=${encodeURIComponent(d.$id)}`,
            updatedAt: d[s.orderBy] ?? new Date().toISOString(),
          }));
        } catch {
          return [];
        }
      })
    );
    vectorResults = fetched.flat();
  } catch {
    vectorResults = [];
  }

  const results = [...substringResults, ...vectorResults]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 30);

  return Response.json({ results });
}
