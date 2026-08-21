import { requireUser } from "@/lib/supabase/server";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export default async function RootPage() {
  await requireUser();

  return <DashboardContent />;
}
