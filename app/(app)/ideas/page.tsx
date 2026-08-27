import { requireUser } from "@/lib/supabase/server";
import { IdeaMapsPanel } from "@/components/dashboard/ideas/idea-maps-panel";

export default async function IdeasPage() {
  await requireUser();
  return (
    <div className="flex flex-1 flex-col p-6">
      <IdeaMapsPanel />
    </div>
  );
}
