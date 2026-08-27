import { getTokenUsage } from "@/lib/llm/gateway";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ usage: getTokenUsage() });
}
