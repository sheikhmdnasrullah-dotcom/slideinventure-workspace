import { requireUser } from "@/lib/supabase/server";
import { AiVentureWorkspace } from "@/components/dashboard/ai-venture/ai-venture-workspace";

export default async function ConceptsPage() {
  await requireUser();
  return <AiVentureWorkspace />;
}
