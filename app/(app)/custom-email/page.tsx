import { requireUser } from "@/lib/supabase/server";
import { CustomEmailPanel } from "@/components/dashboard/gophish/custom-email-panel";

export default async function CustomEmailPage() {
  await requireUser();

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-sm font-medium tracking-wide text-foreground/60 uppercase">
          Custom Email
        </h1>
        <p className="mt-1 text-2xl font-semibold tracking-tight">
          Dedicated email copy for each recipient, sent via GoPhish
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Import leads, write dedicated subject and body for each, optionally use your existing agents to
          research and auto-draft personalized copy via Tavily, then launch through your GoPhish sending
          profiles with anti-spam sanitization, spintax, and deliverability scoring built in.
        </p>
      </div>
      <CustomEmailPanel />
    </div>
  );
}
