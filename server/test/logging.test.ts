import { Writable } from 'node:stream';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const lookup = vi.hoisted(() => vi.fn());

vi.mock('node:dns/promises', () => ({
  lookup,
}));

import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/index.js';

type LogLine = {
  msg?: string;
  statusCode?: number;
  err?: {
    message?: string;
    details?: { hostname?: string };
  };
};

function collectLogs() {
  let buffer = '';
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      buffer += chunk.toString();
      callback();
    },
  });

  return {
    stream,
    lines(): LogLine[] {
      return buffer
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as LogLine);
    },
  };
}

describe('структурные логи ошибок', () => {
  let app: FastifyInstance | undefined;
  let logs: ReturnType<typeof collectLogs>;

  beforeEach(async () => {
    if (app) await app.close();
    lookup.mockReset();
    logs = collectLogs();
    app = await buildApp({
      logger: {
        level: 'info',
        stream: logs.stream,
      },
    });
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('сохраняет причину DNS-сбоя в логе и не отдаёт её клиенту', async () => {
    lookup.mockRejectedValue(new Error('ENOTFOUND'));

    const response = await app.inject({
      method: 'POST',
      url: '/api/analyze-page',
      payload: { url: 'https://missing.test/page' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({ error: 'Не удалось разрешить домен страницы.' });
    expect(response.body).not.toContain('ENOTFOUND');

    const line = logs.lines().find((entry) => entry.msg === 'upstream rejected');
    expect(line?.statusCode).toBe(422);
    expect(line?.err?.message).toContain('ENOTFOUND');
    expect(line?.err?.details).toEqual({ hostname: 'missing.test' });
  });

  it('логирует некорректный URL без текста исключения в ответе', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/analyze-page',
      payload: { url: 'http://[' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'Некорректный URL.' });

    const line = logs.lines().find((entry) => entry.msg === 'validation failed');
    expect(line?.statusCode).toBe(400);
    expect(line?.err?.message).toContain('Некорректный URL');
  });
});
