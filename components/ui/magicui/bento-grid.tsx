import * as React from "react";
import { cn } from "@/lib/utils";

export function BentoGrid({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "grid auto-rows-[22rem] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
        className
      )}
      {...props}
    />
  );
}

export function BentoCard({
  className,
  glow = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { glow?: boolean }) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card/60 p-5",
        "transition-all duration-300 hover:-translate-y-0.5",
        className
      )}
      {...props}
    >
      {glow && (
        <div className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 [background:radial-gradient(400px_circle_at_var(--x,50%)_var(--y,50%),color-mix(in_oklab,var(--primary)_20%,transparent),transparent)]" />
      )}
      {props.children}
    </div>
  );
}
