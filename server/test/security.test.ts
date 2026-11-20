import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/index.js';
import { applyScriptNonce, applySeoToHtml } from '../src/seo.js';

function header(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.join(',');
  return value ?? '';
}

function directive(csp: string, name: string): string {
  return (
    csp
      .split(';')
      .map((part) => part.trim())
      .find((part) => part === name || part.startsWith(`${name} `)) ?? ''
  );
}

function sources(directiveValue: string): string[] {
  return directiveValue.split(/\s+/).slice(1);
}

const FIXTURE_HTML = `<!doctype html><html><head><title>t</title><script type="application/ld+json" id="fitpix-jsonld">{}</script></head><body><div id="root"><div data-seo-shell></div></div><script type="module" src="/assets/index.js"></script></body></html>`;

describe('security headers', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  it('ставит nosniff, referrer и CSP без unsafe-eval', async () => {
    const first = await app.inject({ method: 'GET', url: '/api/health' });
    const second = await app.inject({ method: 'GET', url: '/api/health' });
    const csp = header(first.headers['content-security-policy']);
    const scriptSrc = directive(csp, 'script-src');
    const styleSrc = directive(csp, 'style-src');
    const connectSrc = directive(csp, 'connect-src');

    expect(first.headers['x-content-type-options']).toBe('nosniff');
    expect(first.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(first.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(first.headers['strict-transport-security']).toContain('max-age=');
    expect(first.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(first.headers['cross-origin-embedder-policy']).toBeUndefined();

    expect(scriptSrc).toContain('https://mc.yandex.ru');
    expect(scriptSrc).toContain('https://mc.webvisor.com');
    expect(scriptSrc).toContain('https://yastatic.net');
    expect(scriptSrc).toMatch(/'nonce-[a-f0-9]{32}'/);
    expect(scriptSrc).not.toContain('unsafe-inline');
    expect(scriptSrc).not.toContain('unsafe-eval');
    expect(sources(scriptSrc)).not.toContain('https:');

    expect(styleSrc).toContain("'unsafe-inline'");
    expect(styleSrc).toContain('https://fonts.googleapis.com');
    expect(sources(styleSrc)).not.toContain('https:');
    expect(directive(csp, 'font-src')).toContain('https://fonts.gstatic.com');
    expect(sources(directive(csp, 'img-src'))).toContain('blob:');
    expect(connectSrc).toContain('wss://mc.yandex.ru');
    expect(directive(csp, 'frame-src')).toContain('blob:');
    expect(directive(csp, 'worker-src')).toContain('blob:');
    expect(directive(csp, 'frame-ancestors')).toContain('https://metrika.yandex.ru');
    expect(directive(csp, 'script-src-attr')).toBe("script-src-attr 'none'");
    expect(csp).not.toContain('upgrade-insecure-requests');

    const nonce1 = /'nonce-([a-f0-9]{32})'/.exec(scriptSrc)?.[1];
    const nonce2 = /'nonce-([a-f0-9]{32})'/.exec(
      directive(header(second.headers['content-security-policy']), 'script-src'),
    )?.[1];
    expect(nonce1).toMatch(/^[a-f0-9]{32}$/);
    expect(nonce2).toMatch(/^[a-f0-9]{32}$/);
    expect(nonce1).not.toBe(nonce2);
  });
});

describe('CSP nonce в HTML', () => {
  it('не подписывает скрипт повторно и игнорирует пустой nonce', () => {
    const html = '<script nonce="abc">1</script><script src="/a.js"></script>';
    const nonce = 'a'.repeat(32);
    expect(applyScriptNonce(html, '')).toBe(html);
    expect(applyScriptNonce(html, 'not-a-nonce')).toBe(html);
    expect(applyScriptNonce(html, nonce)).toBe(
      `<script nonce="abc">1</script><script nonce="${nonce}" src="/a.js"></script>`,
    );
  });

  it('подписывает конфиг Метрики и JSON-LD', () => {
    const previous = process.env.VITE_YM_ID;
    process.env.VITE_YM_ID = '123';
    try {
      const nonce = 'b'.repeat(32);
      const html = applySeoToHtml(
        '<!doctype html><html><head><title>t</title></head><body><div id="root"></div></body></html>',
        '/',
        nonce,
      );
      expect(html).toContain(
        `<script nonce="${nonce}" id="fitpix-ym-config">window.__FITPIX_YM_ID__=123;</script>`,
      );
      expect(html).toContain(`<script nonce="${nonce}" type="application/ld+json"`);
    } finally {
      if (previous === undefined) delete process.env.VITE_YM_ID;
      else process.env.VITE_YM_ID = previous;
    }
  });

  it('отдаёт SPA с тем же nonce, что и заголовок CSP', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fitpix-csp-'));
    writeFileSync(join(dir, 'index.html'), FIXTURE_HTML);
    const previous = process.env.STATIC_DIR;
    process.env.STATIC_DIR = dir;
    const app = await buildApp({ logger: false });
    try {
      const response = await app.inject({ method: 'GET', url: '/' });
      const csp = header(response.headers['content-security-policy']);
      const nonce = /'nonce-([a-f0-9]{32})'/.exec(directive(csp, 'script-src'))?.[1];
      expect(response.statusCode).toBe(200);
      expect(nonce).toBeTruthy();
      expect(response.body).toContain(`<script nonce="${nonce}" type="application/ld+json"`);
      expect(response.body).toContain(`<script nonce="${nonce}" type="module" src="/assets/index.js">`);
      expect(response.headers['cache-control']).toBe('private, no-store');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    } finally {
      await app.close();
      if (previous === undefined) delete process.env.STATIC_DIR;
      else process.env.STATIC_DIR = previous;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
