"use client"

import { NotepadView } from "@/components/dashboard/notepad-view"
import { SiteHeader } from "@/components/dashboard/site-header"

export default function NotepadPage() {
  return (
    <>
      <SiteHeader crumbs={[{ label: "Notepad" }]} subtitle="Frictionless notes" />
      <NotepadView scope="global" />
    </>
  )
}
