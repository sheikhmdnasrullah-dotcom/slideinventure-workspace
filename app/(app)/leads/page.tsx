import { requireUser } from "@/lib/supabase/server";
import { LeadsTable } from "@/components/dashboard/leads-table";
import { LeadHarvest } from "@/components/dashboard/leads/lead-harvest";
import { LeadResearchLauncher } from "@/components/dashboard/leads/lead-research-launcher";
import { SiteHeader } from "@/components/dashboard/site-header";
import { PageHeader } from "@/components/system";

export default async function LeadsPage() {
  await requireUser();

  return (
    <>
      <SiteHeader crumbs={[{ label: "Leads" }]} subtitle="Operational database" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <PageHeader eyebrow="Pipeline" title="Leads" actions={<LeadResearchLauncher />} />
        <LeadHarvest />
        <LeadsTable />
      </div>
    </>
  );
}
