import { requireUser } from "@/lib/supabase/server";
import { LeadsTable } from "@/components/dashboard/leads-table";

export default async function LeadsPage() {
  await requireUser();

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-sm font-medium tracking-wide text-foreground/60 uppercase">
          Leads
        </h1>
        <p className="text-xs text-foreground/40">
          Track and manage your business leads.
        </p>
      </div>
      <LeadsTable />
    </div>
  );
}
