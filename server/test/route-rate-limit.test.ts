import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { BUG_REPORT_RATE_LIMIT, OPTIMIZE_RATE_LIMIT } from '../src/config.js';
import { buildApp } from '../src/index.js';

describe('лимит на optimize и bug-report', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  it('останавливает /api/optimize после лимита и не трогает другой IP', async () => {
    const blockedIp = '203.0.113.10';
    const otherIp = '203.0.113.11';

    for (let i = 0; i < OPTIMIZE_RATE_LIMIT; i += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/optimize',
        remoteAddress: '127.0.0.1',
        headers: { 'x-forwarded-for': blockedIp },
      });
      expect(response.statusCode).not.toBe(429);
    }

    const blocked = await app.inject({
      method: 'POST',
      url: '/api/optimize',
      remoteAddress: '127.0.0.1',
      headers: { 'x-forwarded-for': blockedIp },
    });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['retry-after']).toBeTruthy();
    expect(blocked.json()).toEqual({
      error: expect.stringMatching(/^Слишком много оптимизаций\. Подождите ~/),
    });

    const other = await app.inject({
      method: 'POST',
      url: '/api/optimize',
      remoteAddress: '127.0.0.1',
      headers: { 'x-forwarded-for': otherIp },
    });
    expect(other.statusCode).not.toBe(429);
  });

  it('останавливает /api/bug-report после лимита', async () => {
    const ip = '203.0.113.20';

    for (let i = 0; i < BUG_REPORT_RATE_LIMIT; i += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/bug-report',
        remoteAddress: '127.0.0.1',
        headers: { 'x-forwarded-for': ip },
      });
      expect(response.statusCode).not.toBe(429);
    }

    const blocked = await app.inject({
      method: 'POST',
      url: '/api/bug-report',
      remoteAddress: '127.0.0.1',
      headers: { 'x-forwarded-for': ip },
    });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['retry-after']).toBeTruthy();
    expect(blocked.json()).toEqual({
      error: expect.stringMatching(/^Слишком много сообщений\. Подождите ~/),
    });
  });

  it('игнорирует X-Forwarded-For, если сокет не принадлежит прокси', async () => {
    const attacker = '198.51.100.8';

    for (let i = 0; i < BUG_REPORT_RATE_LIMIT; i += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/bug-report',
        remoteAddress: attacker,
        headers: { 'x-forwarded-for': `203.0.113.${i}` },
      });
      expect(response.statusCode).not.toBe(429);
    }

    const rotated = await app.inject({
      method: 'POST',
      url: '/api/bug-report',
      remoteAddress: attacker,
      headers: { 'x-forwarded-for': '203.0.113.200' },
    });
    expect(rotated.statusCode).toBe(429);

    const proxied = await app.inject({
      method: 'POST',
      url: '/api/bug-report',
      remoteAddress: '127.0.0.1',
      headers: { 'x-forwarded-for': '203.0.113.0' },
    });
    expect(proxied.statusCode).not.toBe(429);
  });

  it('за прокси берёт адрес, который добавил прокси', async () => {
    const client = '203.0.113.77';

    for (let i = 0; i < BUG_REPORT_RATE_LIMIT; i += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/bug-report',
        remoteAddress: '127.0.0.1',
        headers: { 'x-forwarded-for': `9.9.9.${i}, ${client}` },
      });
      expect(response.statusCode).not.toBe(429);
    }

    const viaDockerBridge = await app.inject({
      method: 'POST',
      url: '/api/bug-report',
      remoteAddress: '172.17.0.1',
      headers: { 'x-forwarded-for': `1.2.3.4, ${client}` },
    });
    expect(viaDockerBridge.statusCode).toBe(429);
  });
});
