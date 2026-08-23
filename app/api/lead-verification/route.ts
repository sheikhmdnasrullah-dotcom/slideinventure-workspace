import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/supabase/server";

const JOB_API_URL = process.env.LEAD_JOB_API_URL ?? "https://leads.nasrullahtanim.me";
const JOB_API_SECRET = process.env.LEAD_JOB_API_SECRET ?? "";

/**
 * POST /api/lead-verification
 * Receives a CSV file from the browser, forwards it to the VPS job API,
 * and returns { job_id, total_leads } to the client.
 * The LEAD_JOB_API_SECRET header is injected server-side and never reaches the browser.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!JOB_API_SECRET) {
    return NextResponse.json(
      { error: "Server misconfigured: LEAD_JOB_API_SECRET not set" },
      { status: 500 }
    );
  }

  // Forward the multipart form data to the VPS job API
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json({ error: "Only .csv files are accepted" }, { status: 400 });
  }

  // Build new FormData for the upstream request
  const upstream = new FormData();
  upstream.append("file", file);

  try {
    const resp = await fetch(`${JOB_API_URL}/jobs`, {
      method: "POST",
      headers: {
        "x-job-secret": JOB_API_SECRET,
      },
      body: upstream,
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json(
        { error: `Job API error: ${resp.status} ${text}` },
        { status: resp.status }
      );
    }

    const data = await resp.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to reach job API: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }
}
