"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * StaggerGroup: children fade up with a 30ms stagger on first paint only.
 * The .is-live guard is added once after mount, so filtering, sorting,
 * typing or polling never replays the entrance.
 */
export function StaggerGroup({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    ref.current?.classList.add("is-live");
  }, []);
  return (
    <div ref={ref} className={cn("stagger-group", className)} {...props}>
      {children}
    </div>
  );
}

/**
 * StaggerTbody: a tbody whose rows fade up with a 30ms stagger on first
 * paint only. Same once-after-mount guard as StaggerGroup.
 */
export function StaggerTbody({ className, ...props }: React.ComponentProps<"tbody">) {
  const ref = React.useRef<HTMLTableSectionElement>(null);
  React.useEffect(() => {
    ref.current?.classList.add("is-live");
  }, []);
  return (
    <tbody
      ref={ref}
      data-slot="table-body"
      className={cn("stagger-group divide-y divide-rule-soft", className)}
      {...props}
    />
  );
}
