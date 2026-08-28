"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadResearchAssistant } from "@/components/dashboard/leads/lead-research-assistant";

/** Opens the assistant automatically when linked to via `?assistant=1`
 * (the Lead Research Assistant icon in the Agents roster / Agent Canvas). */
export function LeadResearchLauncher() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (params.get("assistant") === "1") {
      setOpen(true);
      router.replace(pathname, { scroll: false });
    }
  }, [params, router, pathname]);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Sparkles className="size-3.5" />
        Research Assistant
      </Button>
      <LeadResearchAssistant open={open} onOpenChange={setOpen} />
    </>
  );
}
