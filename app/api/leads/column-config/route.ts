import { createServiceClient, getSessionUser } from "@/lib/supabase/server";

const DEFAULT_COLUMNS = [
  { id: "select", key: "_select", label: "", visible: true, sortable: false, filterable: false, type: "select", width: 50 },
  { id: "contact", key: "first_name", label: "Contact", visible: true, sortable: true, filterable: true, type: "composite", width: 300 },
  { id: "company", key: "company", label: "Company", visible: true, sortable: true, filterable: false, type: "composite", width: 250 },
  { id: "phone", key: "phone", label: "Phone", visible: true, sortable: true, filterable: false, type: "text", width: 150 },
  { id: "source", key: "source", label: "Source", visible: true, sortable: true, filterable: true, type: "text", width: 120 },
  { id: "status", key: "status", label: "Status", visible: true, sortable: true, filterable: true, type: "status", width: 120 },
  { id: "actions", key: "_actions", label: "", visible: true, sortable: false, filterable: false, type: "actions", width: 100 },
];

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("lead_column_configs")
    .select("columns")
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    return Response.json({ columns: DEFAULT_COLUMNS });
  }

  return Response.json({ columns: data.columns });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { columns } = body as { columns?: unknown[] };

  if (!Array.isArray(columns)) {
    return Response.json({ error: "columns must be an array" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("lead_column_configs")
    .upsert(
      {
        user_id: user.id,
        columns,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ columns }, { status: 200 });
}
