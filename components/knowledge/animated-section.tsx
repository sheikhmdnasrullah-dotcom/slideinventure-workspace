"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { Duration, Ease } from "@/lib/motion";

export function AnimatedSection({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: Duration.slow, delay, ease: Ease.expo }}
    >
      {children}
    </motion.div>
  );
}
