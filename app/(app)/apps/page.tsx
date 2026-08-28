import { requireUser } from "@/lib/supabase/server";
import { AppsClient } from "./apps-client";
import { MailAppsCards } from "@/components/dashboard/apps/mail-apps-cards";

export default async function AppsPage() {
  await requireUser();
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-sm font-medium tracking-wide text-foreground/60 uppercase">
          Apps
        </h1>
        <p className="text-xs text-foreground/40">
          Application launcher for connected workspace tools.
        </p>
      </div>
      
      <MailAppsCards />
      <AppsClient />
    </div>
  );
}