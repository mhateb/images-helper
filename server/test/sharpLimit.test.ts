import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { SHARP_JOB_CONCURRENCY, SHARP_THREADS_PER_IMAGE } from '../src/config.js';
import { withSharpLimit } from '../src/sharpLimit.js';

async function flush(): Promise<void> {
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
}

describe('withSharpLimit', () => {
  it('ограничивает потоки libvips на одно изображение', () => {
    expect(sharp.concurrency()).toBe(SHARP_THREADS_PER_IMAGE);
  });

  it('не запускает больше двух обработок сразу', async () => {
    let active = 0;
    let maxActive = 0;
    let started = 0;
    const gates: Array<() => void> = [];

    const tasks = Array.from({ length: SHARP_JOB_CONCURRENCY + 2 }, () =>
      withSharpLimit(async () => {
        started += 1;
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise<void>((resolve) => {
          gates.push(resolve);
        });
        active -= 1;
      }),
    );

    await flush();
    expect(started).toBe(SHARP_JOB_CONCURRENCY);
    expect(maxActive).toBe(SHARP_JOB_CONCURRENCY);

    gates.shift()?.();
    await flush();
    expect(started).toBe(SHARP_JOB_CONCURRENCY + 1);
    expect(active).toBe(SHARP_JOB_CONCURRENCY);

    while (gates.length > 0) {
      gates.shift()?.();
      await flush();
    }

    await Promise.all(tasks);
    expect(active).toBe(0);
    expect(maxActive).toBe(SHARP_JOB_CONCURRENCY);
  });
});
