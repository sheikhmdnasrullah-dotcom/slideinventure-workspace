import { createServiceClient } from "@/lib/supabase/server";
import { randomUUID } from "node:crypto";

export async function GET(request: Request) {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize")) || 50));
  const sortBy = searchParams.get("sortBy") || "created_at";
  const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc";
  const search = searchParams.get("search")?.trim() || "";
  const status = searchParams.get("status")?.trim() || "";
  const source = searchParams.get("source")?.trim() || "";

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("leads")
    .select("*", { count: "exact" });

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`
    );
  }

  if (status) {
    query = query.eq("status", status);
  }

  if (source) {
    query = query.eq("source", source);
  }

  query = query.order(sortBy, { ascending: sortOrder === "asc" }).range(from, to);

  const { data, error, count } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    data: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const {
      id,
      first_name,
      last_name,
      email,
      company,
      job_title,
      phone,
      source = "manual",
      status = "new",
      notes,
      tags = [],
      custom_fields = {},
    } = body as {
      id?: string;
      first_name?: string;
      last_name?: string;
      email?: string;
      company?: string;
      job_title?: string;
      phone?: string;
      source?: string;
      status?: string;
      notes?: string;
      tags?: string[];
      custom_fields?: Record<string, unknown>;
    };

    if (!first_name || !last_name || !email) {
      return Response.json(
        { error: "first_name, last_name, and email are required" },
        { status: 400 }
      );
    }

    const leadId = id ?? randomUUID();

    const supabase = createServiceClient();
    const { error } = await supabase.from("leads").upsert({
      id: leadId,
      first_name,
      last_name,
      email,
      company: company ?? null,
      job_title: job_title ?? null,
      phone: phone ?? null,
      source,
      status,
      notes: notes ?? null,
      tags,
      custom_fields: custom_fields ?? {},
      updated_at: new Date().toISOString(),
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ id: leadId, status: "created" }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
