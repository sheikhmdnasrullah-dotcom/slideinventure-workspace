import { getBusinessProfile, isIntakeComplete } from "@/lib/intake/store";

import { IntakeForm } from "./intake-form";

export const metadata = { title: "Business Setup — Intake" };

export const dynamic = "force-dynamic";

export default async function IntakePage() {
  const initial = getBusinessProfile();
  const completed = isIntakeComplete();
  return <IntakeForm initial={initial} completed={completed} />;
}
