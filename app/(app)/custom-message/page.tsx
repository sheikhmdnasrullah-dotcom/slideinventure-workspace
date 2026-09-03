import { requireUser } from "@/lib/supabase/server";
import { CustomMessagePanel } from "@/components/dashboard/gophish/custom-message-panel";

export default async function CustomMessagePage() {
  await requireUser();

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-sm font-medium tracking-wide text-foreground/60 uppercase">
          Custom Message
        </h1>
        <p className="mt-1 text-2xl font-semibold tracking-tight">
          Gophish custom campaign
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Import recipients, compose a per-target message, then send through one of
          your Gophish sending profiles.
        </p>
      </div>
      <CustomMessagePanel />
    </div>
  );
}
