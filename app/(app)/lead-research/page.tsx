import { requireUser } from "@/lib/supabase/server";
import { LeadResearchPanel } from "@/components/dashboard/lead-research/lead-research-panel";

export default async function LeadResearchPage() {
  await requireUser();

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-sm font-medium uppercase tracking-wide text-foreground/60">
          Lead Research
        </h1>
        <p className="mt-1 text-2xl font-semibold tracking-tight">
          Research your lead list, then send personalized email
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a CSV of lead email addresses. The dashboard agents research each person across
          the web (search, company sites, public profiles) and fill in a Personalized Information
          column with unique, authentic lines — then export the revised list and drop it into
          Custom Email, where GoPhish sends each recipient their own personalized message.
        </p>
      </div>
      <LeadResearchPanel />
    </div>
  );
}
