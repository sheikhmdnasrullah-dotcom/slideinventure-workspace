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
        "group relative overflow-hidden rounded-lg border border-rule bg-surface p-6 shadow-raised",
        "transition-[border-color] duration-[150ms] hover:border-rule-strong",
        className
      )}
      {...props}
    >
      {props.children}
    </div>
  );
}
