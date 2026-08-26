import { requireUser } from "@/lib/supabase/server";
import { BrowseConsole } from "@/components/dashboard/browse/browse-console";

export default async function BrowsePage() {
  await requireUser();
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-sm font-medium tracking-wide text-foreground/60 uppercase">Browse</h1>
        <p className="text-xs text-foreground/40">
          LLM-driven web agent (Playwright). Automatically solves CAPTCHAs when enabled.
        </p>
      </div>
      <BrowseConsole />
    </div>
  );
}
