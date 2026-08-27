"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Animated connecting beam between two elements (MagicUI-style).
export function AnimatedBeam({
  className,
  containerRef,
  fromRef,
  toRef,
  curvature = 0,
  reverse = false,
  duration = 4,
}: {
  className?: string;
  containerRef: React.RefObject<HTMLElement>;
  fromRef: React.RefObject<HTMLElement>;
  toRef: React.RefObject<HTMLElement>;
  curvature?: number;
  reverse?: boolean;
  duration?: number;
}) {
  const [path, setPath] = React.useState("");

  React.useEffect(() => {
    const update = () => {
      const container = containerRef.current;
      const from = fromRef.current;
      const to = toRef.current;
      if (!container || !from || !to) return;
      const c = container.getBoundingClientRect();
      const a = from.getBoundingClientRect();
      const b = to.getBoundingClientRect();
      const ax = a.left + a.width / 2 - c.left;
      const ay = a.top + a.height / 2 - c.top;
      const bx = b.left + b.width / 2 - c.left;
      const by = b.top + b.height / 2 - c.top;
      const mx = (ax + bx) / 2 + curvature;
      setPath(`M ${ax} ${ay} Q ${mx} ${(ay + by) / 2} ${bx} ${by}`);
    };
    update();
    const id = window.setInterval(update, 500);
    return () => window.clearInterval(id);
  }, [containerRef, fromRef, toRef, curvature]);

  if (!path) return null;
  const id = React.useId();

  return (
    <svg className={cn("pointer-events-none absolute inset-0 h-full w-full", className)} fill="none">
      <defs>
        <linearGradient id={`beam-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0" />
          <stop offset="50%" stopColor="var(--primary)" stopOpacity="0.8" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={path}
        stroke={`url(#beam-${id})`}
        strokeWidth={2}
        strokeDasharray="6 6"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration, repeat: Infinity, ease: "linear", direction: reverse ? "reverse" : "normal" }}
      />
    </svg>
  );
}
