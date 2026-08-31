import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/appwrite/auth";

function parseCsv(text: string): Record<string, string>[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = line.split(",");
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = (vals[i] || "").trim()));
    return obj;
  });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const body = await request.json().catch(() => null);
  let rows: Record<string, string>[] =
    Array.isArray(body?.rows) && body.rows.length ? body.rows : [];
  if (!rows.length && typeof body?.csv === "string") {
    rows = parseCsv(body.csv);
  }
  if (!rows.length) {
    return ApiError.badRequest("NO_ROWS", "provide rows or csv").toResponse();
  }

  const gateway = process.env.TEMPORAL_GATEWAY_URL;
  const key = process.env.TEMPORAL_GATEWAY_KEY;
  if (!gateway || !key) {
    return Response.json({ error: "Browse gateway not configured" }, { status: 503 });
  }

  try {
    const res = await fetch(`${gateway.replace(/\/$/, "")}/csv-discovery`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-temporal-gateway-key": key },
      body: JSON.stringify({ rows }),
    });
    const data = await res.json().catch(() => ({}));
    return Response.json({ workflowId: data.workflowId ?? null, error: data.error ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "csv-discovery failed";
    return Response.json({ error: message }, { status: 502 });
  }
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const workflowId = request.nextUrl.searchParams.get("workflowId");
  if (!workflowId) {
    return ApiError.badRequest("MISSING_ID", "workflowId required").toResponse();
  }

  const gateway = process.env.TEMPORAL_GATEWAY_URL;
  const key = process.env.TEMPORAL_GATEWAY_KEY;
  if (!gateway || !key) {
    return Response.json({ status: "UNKNOWN", results: [] }, { status: 503 });
  }

  try {
    const res = await fetch(
      `${gateway.replace(/\/$/, "")}/csv-discovery/${encodeURIComponent(workflowId)}`,
      { headers: { "x-temporal-gateway-key": key } },
    );
    const data = await res.json().catch(() => ({}));
    return Response.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "csv-discovery failed";
    return Response.json({ status: "UNKNOWN", results: [], error: message }, { status: 502 });
  }
}
