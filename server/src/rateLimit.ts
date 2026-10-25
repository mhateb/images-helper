type WindowBucket = number[];

const buckets = new Map<string, WindowBucket>();

/** Sliding window: at most `limit` events per `windowMs` for a key. */
export function takeRateLimitToken(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const fresh = (buckets.get(key) ?? []).filter((ts) => now - ts < windowMs);

  if (fresh.length >= limit) {
    buckets.set(key, fresh);
    const oldest = fresh[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    return { ok: false, retryAfterSec };
  }

  fresh.push(now);
  buckets.set(key, fresh);
  return { ok: true };
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
