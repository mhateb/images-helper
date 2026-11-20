import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/index.js';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string;
};

describe('GET /api/health', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  it('отдаёт ok, версию пакета и аптайм в секундах', async () => {
    const first = await app.inject({ method: 'GET', url: '/api/health' });
    const second = await app.inject({ method: 'GET', url: '/api/health' });

    expect(first.statusCode).toBe(200);
    expect(first.headers['cache-control']).toBe('no-store');
    expect(second.statusCode).toBe(200);

    const body = first.json() as { ok: boolean; version: string; uptime: number };
    const next = second.json() as { uptime: number };

    expect(body).toEqual({
      ok: true,
      version,
      uptime: body.uptime,
    });
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(Number.isInteger(body.uptime)).toBe(true);
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(next.uptime).toBeGreaterThanOrEqual(body.uptime);
  });
});
