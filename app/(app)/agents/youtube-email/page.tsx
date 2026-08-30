import { redirect } from "next/navigation";

// YouTube extraction is now one agent inside the unified Email Crawler
// pipeline (see /email-crawler) instead of its own dedicated page.
export default function YouTubeEmailAgentPage() {
  redirect("/email-crawler");
}
