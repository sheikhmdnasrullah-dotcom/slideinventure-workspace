import { requireUser } from "@/lib/supabase/server";
import { EmailCrawler } from "@/components/dashboard/email-crawler/email-crawler";

export default async function EmailCrawlerPage() {
  await requireUser();

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-sm font-medium tracking-wide text-foreground/60 uppercase">
          Email Crawler
        </h1>
        <p className="text-xs text-foreground/40">
          Autonomous web agent that finds a prospect&apos;s email from any link or details.
        </p>
      </div>
      <EmailCrawler />
    </div>
  );
}
