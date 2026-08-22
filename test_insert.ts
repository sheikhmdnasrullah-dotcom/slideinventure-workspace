import { createClient } from "@supabase/supabase-js";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const payload = {
    id,
    title: "VPS Root",
    command: "ssh root@123",
    description: "",
    category: "",
    tags: [],
    notes: "",
    variables: {},
    favorite: false,
    triggeredBy: "test@example.com",
    created_at: now,
    updated_at: now,
  };
  console.log("Payload:", payload);
  const { data, error } = await supabase.from("terminal_commands").insert(payload);
  console.log("Result:", data, error);
}
run();
