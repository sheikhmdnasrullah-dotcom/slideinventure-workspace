import { requireUser } from "@/lib/supabase/server";
import { MemoryConsole } from "@/components/dashboard/memory/memory-console";

export default async function MemoryPage() {
  await requireUser();
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-sm font-medium tracking-wide text-foreground/60 uppercase">Memory</h1>
        <p className="text-xs text-foreground/40">
          Short-lived working memory (TTL-based) for agent runs and notes.
        </p>
      </div>
      <MemoryConsole />
    </div>
  );
}
