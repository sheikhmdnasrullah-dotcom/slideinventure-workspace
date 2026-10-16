import { requireUser } from "@/lib/supabase/server";
import { ColdEmailPanel } from "@/components/dashboard/cold-email-panel";

export default async function ColdOutreachPage() {
  await requireUser();

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <h1 className="font-label text-ink-muted">
        Cold Outreach
      </h1>
      <ColdEmailPanel />
    </div>
  );
}
