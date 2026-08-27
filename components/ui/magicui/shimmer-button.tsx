"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Shimmer button (MagicUI-style) used for primary agent triggers.
export function ShimmerButton({
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden rounded-lg px-5 py-2 text-sm font-medium text-primary-foreground",
        "bg-primary/90 transition-colors hover:bg-primary",
        className
      )}
      {...props}
    >
      <span className="relative z-10">{children}</span>
      <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2s_infinite]" />
      <style>{`@keyframes shimmer { 100% { transform: translateX(100%); } }`}</style>
    </button>
  );
}
