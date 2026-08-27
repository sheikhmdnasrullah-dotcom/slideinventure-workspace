import { requireUser } from "@/lib/supabase/server";
import { ResearchLabWorkspace } from "@/components/dashboard/research/research-lab-workspace";

export default async function ResearchLabPage() {
  await requireUser();
  return <ResearchLabWorkspace />;
}
