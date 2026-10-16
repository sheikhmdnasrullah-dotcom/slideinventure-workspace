import { requireUser } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/dashboard/site-header";
import { PageHeader } from "@/components/system";
import { OpportunityPipelineView } from "@/components/dashboard/opportunities/opportunity-pipeline-view";

export default async function OpportunitiesPage() {
  await requireUser();

  return (
    <>
      <SiteHeader crumbs={[{ label: "Opportunities" }]} subtitle="Universal Acquisition Pipeline & 360° Dossiers" />
      <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-6 px-5 py-5 md:px-10 md:py-10">
        <PageHeader
          eyebrow="Universal Acquisition Engine"
          title="Opportunities & Pursuits"
          subtitle="All active prospects, intent signals, AI research dossiers, and conversation threads across all business verticals."
        />
        <OpportunityPipelineView />
      </div>
    </>
  );
}
