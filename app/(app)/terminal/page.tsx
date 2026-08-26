import { requireUser } from "@/lib/supabase/server";
import { TerminalCommands } from "@/components/dashboard/terminal/terminal-commands";
import { XTermShell } from "@/components/dashboard/terminal/xterm-shell";

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
      <div className="flex flex-col gap-2">
        <h2 className="text-xs font-medium tracking-wide text-foreground/60 uppercase">
          Live shell
        </h2>
        <XTermShell />
      </div>
      <TerminalCommands />
    </div>
  );
}
