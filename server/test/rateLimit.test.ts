import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  hasRateLimitBucket,
  startRateLimitCleanup,
  stopRateLimitCleanup,
  sweepExpiredRateLimits,
  takeRateLimitToken,
} from '../src/rateLimit.js';

describe('takeRateLimitToken', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('пропускает запросы в пределах лимита и останавливает следующий', () => {
    const key = `limit-${crypto.randomUUID()}`;

    expect(takeRateLimitToken(key, 2, 60_000)).toEqual({ ok: true });
    expect(takeRateLimitToken(key, 2, 60_000)).toEqual({ ok: true });
    expect(takeRateLimitToken(key, 2, 60_000)).toEqual({
      ok: false,
      retryAfterSec: 60,
    });
  });

  it('считает лимит отдельно для каждого ключа', () => {
    const first = `a-${crypto.randomUUID()}`;
    const second = `b-${crypto.randomUUID()}`;

    expect(takeRateLimitToken(first, 1, 60_000).ok).toBe(true);
    expect(takeRateLimitToken(first, 1, 60_000).ok).toBe(false);
    expect(takeRateLimitToken(second, 1, 60_000)).toEqual({ ok: true });
  });

  it('возвращает остаток окна и снова пускает запрос, когда окно прошло', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(0);
    const key = `window-${crypto.randomUUID()}`;

    expect(takeRateLimitToken(key, 1, 10_000)).toEqual({ ok: true });

    vi.setSystemTime(2_500);
    expect(takeRateLimitToken(key, 1, 10_000)).toEqual({
      ok: false,
      retryAfterSec: 8,
    });

    vi.setSystemTime(9_999);
    expect(takeRateLimitToken(key, 1, 10_000)).toEqual({
      ok: false,
      retryAfterSec: 1,
    });

    vi.setSystemTime(10_000);
    expect(takeRateLimitToken(key, 1, 10_000)).toEqual({ ok: true });
  });

  it('забывает события, которые вышли из окна, и держит лимит по оставшимся', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(0);
    const key = `slide-${crypto.randomUUID()}`;

    expect(takeRateLimitToken(key, 2, 1_000).ok).toBe(true);
    vi.setSystemTime(900);
    expect(takeRateLimitToken(key, 2, 1_000).ok).toBe(true);
    expect(takeRateLimitToken(key, 2, 1_000).ok).toBe(false);

    vi.setSystemTime(1_001);
    expect(takeRateLimitToken(key, 2, 1_000).ok).toBe(true);
    expect(takeRateLimitToken(key, 2, 1_000).ok).toBe(false);
  });

  it('очистка удаляет ключи с истёкшим окном и оставляет живые', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(0);
    const stale = Array.from({ length: 20 }, () => `stale-${crypto.randomUUID()}`);
    for (const key of stale) {
      expect(takeRateLimitToken(key, 1, 5_000).ok).toBe(true);
      expect(takeRateLimitToken(key, 1, 5_000).ok).toBe(false);
    }

    vi.setSystemTime(5_000);
    const live = `live-${crypto.randomUUID()}`;
    expect(takeRateLimitToken(live, 1, 5_000).ok).toBe(true);

    sweepExpiredRateLimits();

    for (const key of stale) expect(hasRateLimitBucket(key)).toBe(false);
    expect(hasRateLimitBucket(live)).toBe(true);
    expect(takeRateLimitToken(stale[0], 1, 5_000)).toEqual({ ok: true });
    expect(takeRateLimitToken(live, 1, 5_000).ok).toBe(false);
  });

  it('по таймеру удаляет ключи, окно которых истекло', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const key = `timer-${crypto.randomUUID()}`;
    expect(takeRateLimitToken(key, 1, 1_000).ok).toBe(true);

    startRateLimitCleanup(500);
    try {
      vi.setSystemTime(1_000);
      vi.advanceTimersByTime(500);
      expect(hasRateLimitBucket(key)).toBe(false);
    } finally {
      stopRateLimitCleanup();
    }
  });
});
