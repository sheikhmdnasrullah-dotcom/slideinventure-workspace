import { Suspense } from "react";
import { requireUser } from "@/lib/supabase/server";
import { TodoistContent } from "@/components/dashboard/todoist/todoist-content";

export default async function TodoistPage() {
  await requireUser();
  return (
    <Suspense fallback={null}>
      <TodoistContent />
    </Suspense>
  );
}
