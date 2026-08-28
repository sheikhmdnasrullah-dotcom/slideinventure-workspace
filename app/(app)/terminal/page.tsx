import { requireUser } from "@/lib/supabase/server";
import { TerminalCommands } from "@/components/dashboard/terminal/terminal-commands";
import { SiteHeader } from "@/components/dashboard/site-header";
import { PageHeader } from "@/components/system";

export default async function TerminalPage() {
  await requireUser();
  return (
    <>
      <SiteHeader crumbs={[{ label: "Terminal" }]} subtitle="Connected environment" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <PageHeader eyebrow="Console" title="Terminal" meta="Reusable bash and terminal commands" />
        <TerminalCommands />
      </div>
    </>
  );
}
