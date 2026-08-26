import { Suspense } from "react"
import { ResearchLabApp } from "@/components/dashboard/v3/research-lab/research-lab-app"

export default function ResearchLabPage() {
  return (
    <Suspense fallback={null}>
      <ResearchLabApp scope="global" syncUrl />
    </Suspense>
  )
}
