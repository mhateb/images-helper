import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const lookup = vi.hoisted(() => vi.fn());
const undiciFetch = vi.hoisted(() => vi.fn());

vi.mock('node:dns/promises', () => ({
  lookup,
}));

vi.mock('undici', async () => {
  const actual = await vi.importActual<typeof import('undici')>('undici');
  return {
    ...actual,
    fetch: undiciFetch,
  };
});

import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/index.js';

function remoteResponse(status: number, contentType: string | null, body: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get(name: string) {
        if (name.toLowerCase() === 'content-type') return contentType;
        return null;
      },
    },
    body,
  };
}

describe('коды ошибок анализа', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    lookup.mockReset();
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    undiciFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('пустой URL страницы — 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/analyze-page',
      payload: { url: '   ' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'Укажите URL страницы.' });
  });

  it('локальный адрес — 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/analyze-page',
      payload: { url: 'http://localhost/admin' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'Нельзя анализировать локальные адреса.' });
    expect(lookup).not.toHaveBeenCalled();
  });

  it('внутренний IP — 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/analyze-page',
      payload: { url: 'http://127.0.0.1/secret' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'Нельзя анализировать внутренние IP-адреса.',
    });
  });

  it('нерезолвящийся домен — 422', async () => {
    lookup.mockRejectedValue(new Error('ENOTFOUND'));

    const response = await app.inject({
      method: 'POST',
      url: '/api/analyze-page',
      payload: { url: 'https://missing.test/page' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({ error: 'Не удалось разрешить домен страницы.' });
  });

  it('ошибочный код страницы — 422', async () => {
    undiciFetch.mockResolvedValue(remoteResponse(404, null, null));

    const response = await app.inject({
      method: 'POST',
      url: '/api/analyze-page',
      payload: { url: 'https://public.test/page' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({ error: 'Страница ответила кодом 404.' });
  });

  it('пустой ответ источника — 502', async () => {
    undiciFetch.mockResolvedValue(remoteResponse(200, 'text/html', null));

    const response = await app.inject({
      method: 'POST',
      url: '/api/analyze-page',
      payload: { url: 'https://public.test/page' },
    });

    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({ error: 'Пустой ответ сервера.' });
  });

  it('пустой список архива — 400, а пустые URL — 422', async () => {
    const empty = await app.inject({
      method: 'POST',
      url: '/api/analyze-download-zip',
      payload: { urls: [] },
    });

    expect(empty.statusCode).toBe(400);
    expect(empty.json()).toEqual({ error: 'Передайте список URL изображений.' });

    const blank = await app.inject({
      method: 'POST',
      url: '/api/analyze-download-zip',
      payload: { urls: ['   '] },
    });

    expect(blank.statusCode).toBe(422);
    expect(blank.json()).toEqual({ error: 'Нет изображений для скачивания.' });
  });
});
