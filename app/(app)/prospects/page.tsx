import { requireUser } from "@/lib/supabase/server";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default async function ProspectsPage() {
  await requireUser();
  return (
    <ComingSoon
      title="Prospects"
      description="The company/people entity model (deferred V2 — see DECISIONS.md). Ships when knowledge/prospects/ has real content driving a structured-query need. Will render classifier-extracted CSV/lead datasets via the adaptive content registry."
    />
  );
}
