"use client";

import Link from "next/link";
import { Mail, ShieldCheck, Video } from "lucide-react";
import { cn } from "@/lib/utils";

export function CrawlerModeNav() {
  const options = [
    {
      id: "crawler-find",
      title: "Find Emails (Crawler)",
      description: "Deep web crawling via Stagehand & Crawl4AI",
      href: "/email-crawler",
      icon: Mail,
      active: true,
    },
    {
      id: "crawler-verify",
      title: "Verify Leads",
      description: "Bulk deliverability verification via Reacher",
      href: "/leads/verify",
      icon: ShieldCheck,
      active: false,
    },
    {
      id: "youtube-extractor",
      title: "YouTube Email Agent",
      description: "Automated YouTube channel business email scraper",
      href: "/agents/youtube-email",
      icon: Video,
      active: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {options.map((opt) => {
        const Icon = opt.icon;
        return (
          <Link
            key={opt.id}
            href={opt.href}
            className={cn(
              "group relative flex flex-col justify-between rounded-xl border p-4 transition-all duration-200",
              opt.active
                ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-sm"
                : "border-rule bg-[var(--surface)] hover:border-rule-strong hover:bg-[var(--surface-2)]/40 hover:-translate-y-0.5"
            )}
          >
            <div>
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "flex size-10 items-center justify-center rounded-lg transition-transform group-hover:scale-105",
                    opt.active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  <Icon className="size-5" />
                </span>
                {opt.active && (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    Active
                  </span>
                )}
              </div>
              <h3 className="mt-3 font-label text-sm font-semibold text-ink-strong">
                {opt.title}
              </h3>
              <p className="mt-1 text-xs text-ink-muted leading-relaxed">
                {opt.description}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
