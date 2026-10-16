"use client";

import Link from "next/link";
import { Mail, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function CrawlerModeNav() {
  const options = [
    {
      id: "crawler-find",
      title: "Find Emails (Multi-Agent Crawler)",
      description: "YouTube, deep crawl, live browsing, pattern verify & OSINT harvest — one pipeline, automatic handoff",
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
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {options.map((opt) => {
        const Icon = opt.icon;
        return (
          <Link
            key={opt.id}
            href={opt.href}
            className={cn(
              "group relative flex flex-col justify-between rounded-lg border p-6 shadow-raised transition-shadow duration-[150ms]",
              opt.active
                ? "border-transparent bg-flame-wash shadow-raised"
                : "border-rule bg-surface hover:shadow-float"
            )}
          >
            <div>
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "flex size-10 items-center justify-center rounded-[10px]",
                    opt.active
                      ? "bg-button-primary text-on-button-primary"
                      : "bg-surface-2 text-ink-strong"
                  )}
                >
                  <Icon className="size-5" />
                </span>
                {opt.active && (
                  <span className="inline-flex h-[26px] items-center rounded-full bg-surface px-2.5 text-xs font-medium text-flame shadow-raised">
                    Active
                  </span>
                )}
              </div>
              <h3 className="mt-3 text-[15px] font-semibold tracking-[-0.01em] text-ink-strong">
                {opt.title}
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                {opt.description}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
