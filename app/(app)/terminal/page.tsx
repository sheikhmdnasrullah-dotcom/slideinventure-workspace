import { requireUser } from "@/lib/supabase/server";
import { TerminalCommands } from "@/components/dashboard/terminal/terminal-commands";

export default async function TerminalPage() {
  await requireUser();
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-sm font-medium tracking-wide text-foreground/60 uppercase">
          Terminal
        </h1>
        <p className="text-xs text-foreground/40">
          Reusable bash and terminal commands.
        </p>
      </div>
      <TerminalCommands />
    </div>
  );
}
