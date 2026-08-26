import { requireUser } from "@/lib/supabase/server";
import { ActivityFeed } from "@/components/dashboard/activity-feed";

export default async function ActivityPage() {
  await requireUser();
  return <ActivityFeed />;
}
