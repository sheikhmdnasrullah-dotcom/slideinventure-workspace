"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Primary agent trigger. Same API as before (button props + children),
// rendered as the standard primary pill — no looping shimmer.
export function ShimmerButton({
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button className={cn(className)} {...props}>
      {children}
    </Button>
  );
}
