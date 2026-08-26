"use client";

import { AnimatePresence, motion, MotionConfig, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Duration, Ease, MotionDiv } from "@/lib/motion";

/**
 * One cohesive motion system for the dashboard. Built on the existing
 * `lib/motion.tsx` tokens (expo easing, 80/140/220/420/620ms scale) and the
 * Base UI `data-starting/ending-style` primitives already used by
 * dialogs/popovers/drawers — so popovers, modals, tabs and page transitions
 * all share the same timing language.
 */

/**
 * Page/section transition. Mounted once in the (app) layout, keyed by pathname.
 * The sidebar/header shell stays mounted, so only the content swaps — navigation
 * reads as movement inside one app rather than a full reload. Respecting
 * `prefers-reduced-motion` by rendering a static wrapper.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>;
  }

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          className="flex min-h-0 min-w-0 flex-1 flex-col"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4, transition: { duration: Duration.fast, ease: Ease.expo } }}
          transition={{ duration: Duration.base, ease: Ease.expo }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  );
}

/** A card that lifts subtly on hover and settles on press. Pair with the
 *  `.motion-card` utility class for the CSS hover elevation. */
export function MotionCard({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <MotionDiv
      className={cn("motion-card", className)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: Duration.fast, ease: Ease.expo, delay }}
    >
      {children}
    </MotionDiv>
  );
}

/** Generic entrance wrapper: fade + small rise. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 10,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  return (
    <MotionDiv
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: Duration.fast, ease: Ease.expo, delay }}
    >
      {children}
    </MotionDiv>
  );
}

/** Container that staggers its direct children's entrances. Use with StaggerItem
 *  (or any child using `fadeUp`) so lists/cards arrive in a short cascade. */
export function Stagger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <MotionDiv
      className={className}
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.04 } } }}
      initial="hidden"
      animate="visible"
    >
      {children}
    </MotionDiv>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <MotionDiv
      className={className}
      variants={{
        hidden: { opacity: 0, y: 8 },
        visible: { opacity: 1, y: 0, transition: { duration: Duration.fast, ease: Ease.expo } },
      }}
    >
      {children}
    </MotionDiv>
  );
}
