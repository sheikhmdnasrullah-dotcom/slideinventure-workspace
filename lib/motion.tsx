"use client";

import {
  motion,
  useReducedMotion,
  type HTMLMotionProps,
  type Variants,
} from "framer-motion";
import { useMemo } from "react";

const EASE_EXPO = [0.16, 1, 0.3, 1] as const;
const EASE_STD = [0.4, 0, 0.2, 1] as const;

const EASE_MAP = { expo: EASE_EXPO, std: EASE_STD } as const;

export const Ease = EASE_MAP;

export const Duration = {
  instant: 0.08,
  fast: 0.14,
  base: 0.22,
  slow: 0.42,
  reveal: 0.62,
} as const;

export function MotionDiv(props: HTMLMotionProps<"div">) {
  const prefersReduced = useReducedMotion();

  const merged = useMemo(() => {
    if (!prefersReduced) return props;
    const { transition: _t, initial, animate, variants, ...rest } = props;
    void _t;
    const settled = animate ?? initial;
    return {
      ...rest,
      variants,
      initial: settled,
      animate: settled,
      transition: { duration: 0 },
    };
  }, [props, prefersReduced]);

  return <motion.div {...merged} />;
}

export function useEase(name: keyof typeof EASE_MAP = "expo") {
  return EASE_MAP[name];
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: EASE_EXPO },
  },
};

export const staggerParent: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};

export { motion };
