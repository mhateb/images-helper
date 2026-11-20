import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance, FastifyReply } from 'fastify';
import './config.js';
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

  const sendSpa = (pathname: string, reply: FastifyReply) => {
    if (!indexHtml) {
      return reply.code(500).send({ error: 'UI is not built' });
    }
    const html = applySeoToHtml(indexHtml, pathname);
    return reply
      .type('text/html; charset=utf-8')
      .header('Cache-Control', 'no-cache')
      .send(html);
  };

  for (const path of SPA_PATHS) {
    app.get(path, async (_request, reply) => sendSpa(path, reply));
  }

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'Not found' });
    }

    const pathname = normalizePath(request.url);
    if (SPA_PATHS.has(pathname) && indexHtml) {
      return sendSpa(pathname, reply);
    }

    return reply
      .code(404)
      .type('text/html; charset=utf-8')
      .header('X-Robots-Tag', 'noindex, nofollow')
      .send(notFoundPageHtml());
  });

  app.log.info(`Serving static UI from ${staticDir}`);
}
