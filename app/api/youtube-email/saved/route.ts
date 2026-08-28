import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/appwrite/auth";
import {
  getSavedProspects,
  saveProspects,
  deleteProspect,
} from "@/lib/youtube-email/storage";

export async function GET() {
  const user = await getSessionUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prospects = getSavedProspects();
  return NextResponse.json({ prospects, total: prospects.length });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const items = Array.isArray(body.items) ? body.items : body.item ? [body.item] : [];

  if (!items.length) {
    return NextResponse.json({ error: "No prospect items provided" }, { status: 400 });
  }

  const result = await saveProspects(items);
  return NextResponse.json(result);
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  const success = await deleteProspect(id);
  return NextResponse.json({ success });
}
