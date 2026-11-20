type WindowBucket = {
  hits: number[];
  windowMs: number;
};

const buckets = new Map<string, WindowBucket>();

/** How often idle keys are dropped. Windows themselves are per bucket. */
export const RATE_LIMIT_SWEEP_MS = 60_000;

function freshHits(hits: number[], windowMs: number, now: number): number[] {
  return hits.filter((ts) => now - ts < windowMs);
}

/** Sliding window: at most `limit` events per `windowMs` for a key. */
export function takeRateLimitToken(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const fresh = freshHits(buckets.get(key)?.hits ?? [], windowMs, now);

  if (fresh.length >= limit) {
    buckets.set(key, { hits: fresh, windowMs });
    const oldest = fresh[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    return { ok: false, retryAfterSec };
  }

  fresh.push(now);
  buckets.set(key, { hits: fresh, windowMs });
  return { ok: true };
}

/** Drop buckets whose events have all left the window. */
export function sweepExpiredRateLimits(now = Date.now()): void {
  for (const [key, bucket] of buckets) {
    const fresh = freshHits(bucket.hits, bucket.windowMs, now);
    if (fresh.length === 0) {
      buckets.delete(key);
      continue;
    }
    if (fresh.length !== bucket.hits.length) bucket.hits = fresh;
  }
}

export function hasRateLimitBucket(key: string): boolean {
  return buckets.has(key);
}

let subscribers = 0;
let sweepTimer: ReturnType<typeof setInterval> | undefined;

export function startRateLimitCleanup(intervalMs = RATE_LIMIT_SWEEP_MS): void {
  subscribers += 1;
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    sweepExpiredRateLimits();
  }, intervalMs);
  sweepTimer.unref?.();
}

export function stopRateLimitCleanup(): void {
  subscribers = Math.max(0, subscribers - 1);
  if (subscribers > 0 || !sweepTimer) return;
  clearInterval(sweepTimer);
  sweepTimer = undefined;
}

let activeZipJobs = 0;

export function tryAcquireZipSlot(maxActive: number): boolean {
  if (activeZipJobs >= maxActive) return false;
  activeZipJobs += 1;
  return true;
}

export function releaseZipSlot(): void {
  activeZipJobs = Math.max(0, activeZipJobs - 1);
}
