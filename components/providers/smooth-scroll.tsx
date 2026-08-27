"use client";

import * as React from "react";
import { ReactLenis } from "lenis/react";

/**
 * Global smooth scrolling.
 *
 * Tuned for a workstation rather than a landing page: a short lerp so the view
 * settles almost immediately and keyboard/trackpad input stays responsive.
 * Touch smoothing is left off so mobile and trackpad gestures keep their native
 * feel, and `data-lenis-prevent` on any inner scroller (sidebar, chat log,
 * terminal output, canvas) hands that surface back to the browser.
 *
 * When the OS asks for reduced motion, Lenis is not mounted at all: scrolling
 * falls through to the native implementation instead of being animated.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const [reduced, setReduced] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // Until the preference is known, render children directly. Mounting Lenis and
  // then unmounting it would reset scroll position on first paint.
  if (reduced !== false) return children as React.ReactElement;

  return (
    <ReactLenis
      root
      options={{
        lerp: 0.12,
        duration: 0.9,
        smoothWheel: true,
        syncTouch: false,
        wheelMultiplier: 1,
      }}
    >
      {children}
    </ReactLenis>
  );
}
