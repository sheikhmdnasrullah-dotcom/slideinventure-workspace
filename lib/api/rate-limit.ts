"use server";

type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

function getClientId(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "anon";
  return ip;
}

export type RateLimitOptions = {
  identifier?: string;
  limit?: number;
  windowMs?: number;
};

export function checkRateLimit(request: Request, options: RateLimitOptions = {}): { allowed: boolean; remaining: number; resetAt: number } {
  const { limit = 10, windowMs = 60_000 } = options;
  const id = options.identifier ?? `${getClientId(request)}`;
  const now = Date.now();
  const bucket = store.get(id);

  if (!bucket || now >= bucket.resetAt) {
    const nextReset = now + windowMs;
    store.set(id, { count: 1, resetAt: nextReset });
    return { allowed: true, remaining: limit - 1, resetAt: nextReset };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = 0;

export function sweepRateLimits(): void {
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of store) {
    if (now >= bucket.resetAt) {
      store.delete(key);
    }
  }
}
