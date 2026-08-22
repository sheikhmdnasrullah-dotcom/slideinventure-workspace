import { requireUser } from "@/lib/supabase/server"
import NotionSection from "@/components/dashboard/integrations/notion/section"

export default async function NotionPage() {
  await requireUser()
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <NotionSection />
    </div>
  )
}
