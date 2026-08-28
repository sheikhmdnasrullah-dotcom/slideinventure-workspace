"use client";

import { Mail, ExternalLink } from "lucide-react";

export function MailAppsCards() {
  const mailApps = [
    {
      id: "mailgo",
      title: "Mailgo Admin",
      description: "Mail server administration and management portal",
      href: "https://admin.tanim.tech",
      color: "#6366f1",
    },
    {
      id: "sogo-mail",
      title: "SOGo Webmail",
      description: "Webmail, calendar, and groupware console",
      href: "https://mail.nasrullahtanim.me/admin",
      color: "#06b6d4",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {mailApps.map((app) => (
        <a
          key={app.id}
          href={app.href}
          target="_blank"
          rel="noreferrer noopener"
          className="group flex flex-col justify-between rounded-xl border border-rule bg-[var(--surface)] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
        >
          <div>
            <div className="flex items-center justify-between">
              <span
                className="flex size-10 items-center justify-center rounded-lg transition-transform group-hover:scale-105"
                style={{
                  background: `color-mix(in oklch, ${app.color} 14%, transparent)`,
                  color: app.color,
                }}
              >
                <Mail className="size-5" />
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                External <ExternalLink className="size-2.5" />
              </span>
            </div>
            <h3 className="mt-3 font-label text-sm font-semibold text-ink-strong group-hover:text-primary transition-colors">
              {app.title}
            </h3>
            <p className="mt-1 text-xs text-ink-muted leading-relaxed">
              {app.description}
            </p>
          </div>
          <div className="mt-4 pt-2.5 border-t border-rule/60 flex items-center justify-between text-[11px] text-ink-muted">
            <span>Launch Web App</span>
            <span className="font-medium text-primary">Open →</span>
          </div>
        </a>
      ))}
    </div>
  );
}
