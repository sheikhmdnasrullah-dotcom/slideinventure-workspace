import { requireUser } from "@/lib/supabase/server";
import { AIVentureApp } from "@/components/dashboard/v3/ai-venture/ai-venture-app";

export default async function AIVenturePage() {
  await requireUser();

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] flex-col">
      <AIVentureApp navCollapsedSize={4} />
    </div>
  );
}
