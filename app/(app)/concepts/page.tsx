import { Suspense } from "react"
import { requireUser } from "@/lib/supabase/server"
import { AiVentureWorkspace } from "../../../AI Venture/next-integration/components/dashboard/ai-venture/ai-venture-workspace"

export default async function ConceptsPage() {
  await requireUser()
  return (
    <Suspense
      fallback={<div className="p-6 text-sm text-muted-foreground">Loading</div>}
    >
      <AiVentureWorkspace />
    </Suspense>
  )
}
