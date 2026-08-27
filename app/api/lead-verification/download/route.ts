import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/appwrite/auth";

const JOB_API_URL = process.env.LEAD_JOB_API_URL ?? "https://leads.nasrullahtanim.me";
const JOB_API_SECRET = process.env.LEAD_JOB_API_SECRET ?? "";

/**
 * GET /api/lead-verification/download?jobId=<uuid>
 * Proxies the CSV download from the VPS job API.
 * The x-job-secret header is injected server-side, never reaches the browser.
 */
export async function GET(request: NextRequest) {
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

  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId query param" }, { status: 400 });
  }

  // Validate job ID format (UUID)
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(jobId)) {
    return NextResponse.json({ error: "Invalid jobId format" }, { status: 400 });
  }

  try {
    const resp = await fetch(`${JOB_API_URL}/jobs/${jobId}/download`, {
      headers: {
        "x-job-secret": JOB_API_SECRET,
      },
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json(
        { error: `Job API error: ${resp.status} ${text}` },
        { status: resp.status }
      );
    }

    // Stream the CSV back to the browser
    const csvContent = await resp.arrayBuffer();
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="leads_verified_${jobId.slice(0, 8)}.csv"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to reach job API: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }
}
