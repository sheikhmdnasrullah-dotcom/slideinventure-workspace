import { Suspense } from "react";
import { requireUser } from "@/lib/supabase/server";
import { BrainstormWorkspace } from "@/components/dashboard/brainstorm/brainstorm-workspace";

export default async function BrainstormPage() {
  await requireUser();
  return (
    <Suspense fallback={null}>
      <BrainstormWorkspace />
    </Suspense>
  );
}
