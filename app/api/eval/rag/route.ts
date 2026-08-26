import { getSessionUser } from "@/lib/appwrite/auth";
import { evaluateRag } from "@/lib/eval/rag";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const query = (body.query as string | undefined)?.toString().slice(0, 2000);
  if (!query?.trim()) return NextResponse.json({ error: "query required" }, { status: 400 });

  const result = await evaluateRag({
    query: query.trim(),
    contexts: Array.isArray(body.contexts) ? body.contexts.map(String).slice(0, 10) : undefined,
    answer: typeof body.answer === "string" ? body.answer : undefined,
  });
  return NextResponse.json(result);
}
