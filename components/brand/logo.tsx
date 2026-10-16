/**
 * BRAND — SlideIn Venture Wordmark
 * ---------------------------------------------------------------------------
 * The identity is a live-text WORDMARK, not an icon mark.
 * It inverts with theme automatically via --on-surface and --text-accent.
 */

import { cn } from "@/lib/utils";

export function LogoWordmark({
  className,
  size = "20px",
  qualifier = "OS",
}: {
  className?: string;
  size?: string;
  qualifier?: string;
}) {
  return (
    <span className={cn("wordmark", className)} style={{ fontSize: size }}>
      <span className="wordmark-name" aria-hidden>
        SlideIn
      </span>
      <span className="wordmark-qualifier" aria-hidden>
        {qualifier}
      </span>
      <span className="sr-only">SlideIn {qualifier}</span>
    </span>
  );
}

export default LogoWordmark;
