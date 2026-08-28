import { getSessionUser } from "@/lib/appwrite/auth";
import { researchLeads, type ResearchRequest } from "@/lib/leads/research";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 180;

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));

  let req: ResearchRequest;
  if (body.mode === "rows") {
    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      return NextResponse.json({ ok: false, error: "No rows to research" }, { status: 400 });
    }
    req = { mode: "rows", rows: body.rows };
  } else {
    const text = (body.text as string | undefined)?.toString().slice(0, 2000) ?? "";
    req = { mode: "describe", text };
  }

  const res = await researchLeads(req, user.email);
  return NextResponse.json(res);
}
