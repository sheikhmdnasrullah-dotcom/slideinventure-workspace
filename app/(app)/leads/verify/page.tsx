import { requireUser } from "@/lib/supabase/server";
import { VerificationPanel } from "@/components/dashboard/lead-verification/verification-panel";
import { TruemailPanel } from "@/components/dashboard/lead-verification/truemail-panel";

export const metadata = {
  title: "Lead Verification: SlideIn Venture",
  description: "Bulk email deliverability verification for lead lists",
};

export default async function LeadVerificationPage() {
  await requireUser();

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-sm font-medium tracking-wide text-foreground/60 uppercase">
          Lead Verification
        </h1>
        <p className="text-xs text-foreground/40">
          Upload a CSV and verify email deliverability at scale via Reacher.
        </p>
      </div>
      <VerificationPanel />
      <TruemailPanel />
    </div>
  );
}
