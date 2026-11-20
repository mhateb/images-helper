import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import './config.js';
import { cspNonceFrom } from './security.js';
import {
  SPA_PATHS,
  applySeoToHtml,
  normalizePath,
  notFoundPageHtml,
} from './seo.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveStaticDir(): string | null {
  if (process.env.STATIC_DIR) {
    return resolve(process.env.STATIC_DIR);
  }
  const candidates = [
    resolve(__dirname, '../../client/dist'),
    resolve(__dirname, '../public'),
  ];
  return candidates.find((dir) => existsSync(join(dir, 'index.html'))) ?? null;
}

export async function registerStatic(app: FastifyInstance): Promise<void> {
  const staticDir = resolveStaticDir();
  if (!staticDir) return;

  const indexHtmlPath = join(staticDir, 'index.html');
  const indexHtml = existsSync(indexHtmlPath)
    ? readFileSync(indexHtmlPath, 'utf8')
    : null;

  await app.register(fastifyStatic, {
    root: staticDir,
    wildcard: false,
    index: false,
  });

  const sendSpa = (pathname: string, request: FastifyRequest, reply: FastifyReply) => {
    if (!indexHtml) {
      return reply.code(500).send({ error: 'UI is not built' });
    }
    const html = applySeoToHtml(indexHtml, pathname, cspNonceFrom(request));
    // Nonce в HTML и в CSP должен совпадать, поэтому документ нельзя отдавать из общего кэша.
    return reply
      .type('text/html; charset=utf-8')
      .header('Cache-Control', 'private, no-store')
      .send(html);
  };

  for (const path of SPA_PATHS) {
    app.get(path, async (request, reply) => sendSpa(path, request, reply));
  }

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'Not found' });
    }

    const pathname = normalizePath(request.url);
    if (SPA_PATHS.has(pathname) && indexHtml) {
      return sendSpa(pathname, request, reply);
    }

    return reply
      .code(404)
      .type('text/html; charset=utf-8')
      .header('Cache-Control', 'private, no-store')
      .header('X-Robots-Tag', 'noindex, nofollow')
      .send(notFoundPageHtml());
  });

  app.log.info({ staticDir }, 'serving static ui');
}
