import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/index.js';
import { stopRateLimitCleanup } from '../src/rateLimit.js';
import { registerGracefulShutdown, shutdownApp } from '../src/shutdown.js';

describe('graceful shutdown', () => {
  const apps: FastifyInstance[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    for (const app of apps.splice(0)) {
      try {
        await app.close();
      } catch (error) {
        const code =
          typeof error === 'object' && error !== null && 'code' in error
            ? String(error.code)
            : '';
        if (!code.includes('CLOSE')) throw error;
      }
    }
  });

  it('по SIGTERM закрывает сервер и завершает процесс с кодом 0', async () => {
    const app = await buildApp({ logger: false });
    apps.push(app);
    await app.listen({ port: 0, host: '127.0.0.1' });

    const exit = vi.fn();
    shutdownApp(app, 'SIGTERM', { exit, timeoutMs: 2_000 });

    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(app.server.listening).toBe(false);

    shutdownApp(app, 'SIGINT', { exit, timeoutMs: 2_000 });
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it('завершает процесс с кодом 1, если закрытие не уложилось в таймаут', async () => {
    const app = await buildApp({ logger: false });
    apps.push(app);
    vi.spyOn(app, 'close').mockImplementation(() => new Promise(() => {}) as never);

    const exit = vi.fn();
    shutdownApp(app, 'SIGTERM', { exit, timeoutMs: 30 });

    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
    stopRateLimitCleanup();
  });

  it('подписывается на SIGTERM и снимает обработчики', async () => {
    const app = await buildApp({ logger: false });
    apps.push(app);

    const before = {
      term: process.listenerCount('SIGTERM'),
      int: process.listenerCount('SIGINT'),
      exception: process.listenerCount('uncaughtException'),
      rejection: process.listenerCount('unhandledRejection'),
    };

    const unsubscribe = registerGracefulShutdown(app);
    expect(process.listenerCount('SIGTERM')).toBe(before.term + 1);
    expect(process.listenerCount('SIGINT')).toBe(before.int + 1);
    expect(process.listenerCount('uncaughtException')).toBe(before.exception + 1);
    expect(process.listenerCount('unhandledRejection')).toBe(before.rejection + 1);

    unsubscribe();
    expect(process.listenerCount('SIGTERM')).toBe(before.term);
    expect(process.listenerCount('SIGINT')).toBe(before.int);
    expect(process.listenerCount('uncaughtException')).toBe(before.exception);
    expect(process.listenerCount('unhandledRejection')).toBe(before.rejection);
  });
});
