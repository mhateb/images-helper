import sharp from 'sharp';
import { SHARP_JOB_CONCURRENCY, SHARP_THREADS_PER_IMAGE } from './config.js';

// sharp.concurrency ограничивает потоки libvips на картинку, а не число
// картинок. Очередь ниже не даёт нескольким запросам одновременно держать
// в памяти исходники по 30 МБ и их декодированные копии.
sharp.concurrency(SHARP_THREADS_PER_IMAGE);

let active = 0;
const waiters: Array<() => void> = [];

export function withSharpLimit<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      active += 1;
      Promise.resolve()
        .then(task)
        .then(resolve, reject)
        .finally(() => {
          active -= 1;
          waiters.shift()?.();
        });
    };

    if (active < SHARP_JOB_CONCURRENCY) run();
    else waiters.push(run);
  });
}
