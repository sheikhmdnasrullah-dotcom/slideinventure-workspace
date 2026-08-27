import { NextRequest, NextResponse } from "next/server";
import { getAgentPrompt } from "@/lib/agents/roster";

const GATEWAY = process.env.TEMPORAL_GATEWAY_URL;
const KEY = process.env.TEMPORAL_GATEWAY_KEY;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!GATEWAY) {
    return NextResponse.json({ error: "TEMPORAL_GATEWAY_URL is not configured" }, { status: 500 });
  }
  const { slug, message } = await req.json();
  if (!slug || !message) {
    return NextResponse.json({ error: "slug and message are required" }, { status: 400 });
  }
  const agent = getAgentPrompt(slug);
  if (!agent) {
    return NextResponse.json({ error: `Unknown agent: ${slug}` }, { status: 404 });
  }

  const upstream = await fetch(`${GATEWAY}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-temporal-gateway-key": KEY || "",
    },
    body: JSON.stringify({
      slug,
      systemPrompt: agent.prompt,
      userPrompt: message,
    }),
  });
  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}

export async function GET(req: NextRequest) {
  if (!GATEWAY) {
    return NextResponse.json({ error: "TEMPORAL_GATEWAY_URL is not configured" }, { status: 500 });
  }
  const workflowId = req.nextUrl.searchParams.get("workflowId");
  if (!workflowId) {
    return NextResponse.json({ error: "workflowId is required" }, { status: 400 });
  }

  const upstream = await fetch(`${GATEWAY}/run/${encodeURIComponent(workflowId)}`, {
    headers: { "x-temporal-gateway-key": KEY || "" },
  });
  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
