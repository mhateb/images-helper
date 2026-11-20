import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  ANALYZE_LIMITS,
  analyzePage,
  buildOptimizedZipFromUrls,
  fetchRemoteImage,
} from '../analyzePage.js';
import {
  ANALYZE_RATE_LIMIT,
  ANALYZE_RATE_WINDOW_MS,
  MAX_ACTIVE_ZIP_JOBS,
  ZIP_RATE_LIMIT,
  ZIP_RATE_WINDOW_MS,
} from '../config.js';
import {
  releaseZipSlot,
  takeRateLimitToken,
  tryAcquireZipSlot,
} from '../rateLimit.js';

function clientIp(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim() || request.ip;
  }
  return request.ip;
}

function sanitizeBaseName(value: unknown, fallback: string): string {
  const raw = String(value ?? '').trim() || fallback;
  const cleaned = raw
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || 'image';
}

export function registerAnalyzeRoutes(app: FastifyInstance): void {
  app.post('/api/analyze-page', async (request, reply) => {
    const ip = clientIp(request);
    const rate = takeRateLimitToken(
      `analyze:${ip}`,
      ANALYZE_RATE_LIMIT,
      ANALYZE_RATE_WINDOW_MS,
    );
    if (!rate.ok) {
      return reply
        .code(429)
        .header('Retry-After', String(rate.retryAfterSec))
        .send({
          error: `Слишком много анализов. Подождите ~${rate.retryAfterSec} сек.`,
        });
    }

    const body = (request.body ?? {}) as { url?: unknown };
    const rawUrl = typeof body.url === 'string' ? body.url : '';

    try {
      const result = await analyzePage(rawUrl);
      return reply.send(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Не удалось проанализировать страницу.';
      const code =
        /локальн|внутренн|Некорректный|Укажите|Допустимы|логином/i.test(message)
          ? 400
          : /Превышено|ответила|разрешить|Редирект|слишком|HTML/i.test(message)
            ? 422
            : 502;
      if (code >= 500) request.log.error(error);
      return reply.code(code).send({ error: message });
    }
  });

  app.post('/api/analyze-fetch-image', async (request, reply) => {
    const ip = clientIp(request);
    const rate = takeRateLimitToken(`fetch-image:${ip}`, 30, ANALYZE_RATE_WINDOW_MS);
    if (!rate.ok) {
      return reply
        .code(429)
        .header('Retry-After', String(rate.retryAfterSec))
        .send({
          error: `Слишком много загрузок. Подождите ~${rate.retryAfterSec} сек.`,
        });
    }

    const body = (request.body ?? {}) as { url?: unknown };
    const rawUrl = typeof body.url === 'string' ? body.url : '';
    if (!rawUrl.trim()) {
      return reply.code(400).send({ error: 'Укажите URL изображения.' });
    }

    try {
      const image = await fetchRemoteImage(rawUrl);
      const baseName = sanitizeBaseName(image.fileName, 'image');
      const ext =
        image.contentType === 'image/jpeg'
          ? 'jpg'
          : image.contentType === 'image/png'
            ? 'png'
            : image.contentType === 'image/webp'
              ? 'webp'
              : image.contentType === 'image/avif'
                ? 'avif'
                : image.contentType === 'image/gif'
                  ? 'gif'
                  : 'bin';

      reply
        .header('Content-Type', image.contentType)
        .header('Content-Disposition', `inline; filename="${baseName}.${ext}"`)
        .header('X-Extension', ext)
        .header('X-File-Name', `${baseName}.${ext}`);

      return reply.send(image.buffer);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Не удалось загрузить изображение.';
      const code =
        /локальн|внутренн|Некорректный|Укажите|Допустимы|логином|не изображение|SVG/i.test(
          message,
        )
          ? 400
          : /Превышено|ответила|разрешить|Редирект|слишком/i.test(message)
            ? 422
            : 502;
      if (code >= 500) request.log.error(error);
      return reply.code(code).send({ error: message });
    }
  });

  app.post('/api/analyze-download-zip', async (request, reply) => {
    const ip = clientIp(request);
    const rate = takeRateLimitToken(`zip:${ip}`, ZIP_RATE_LIMIT, ZIP_RATE_WINDOW_MS);
    if (!rate.ok) {
      return reply
        .code(429)
        .header('Retry-After', String(rate.retryAfterSec))
        .send({
          error: `Слишком много загрузок архива. Подождите ~${rate.retryAfterSec} сек.`,
        });
    }

    if (!tryAcquireZipSlot(MAX_ACTIVE_ZIP_JOBS)) {
      return reply.code(429).send({
        error: 'Сервер сейчас собирает другие архивы. Попробуйте через минуту.',
      });
    }

    const body = (request.body ?? {}) as { urls?: unknown; pageUrl?: unknown };
    const urls = Array.isArray(body.urls)
      ? body.urls.filter((item): item is string => typeof item === 'string')
      : [];

    if (urls.length === 0) {
      releaseZipSlot();
      return reply.code(400).send({ error: 'Передайте список URL изображений.' });
    }

    if (urls.length > ANALYZE_LIMITS.maxZipImages) {
      releaseZipSlot();
      return reply.code(400).send({
        error: `В архив можно положить не больше ${ANALYZE_LIMITS.maxZipImages} изображений.`,
      });
    }

    try {
      const result = await buildOptimizedZipFromUrls(urls);
      const host =
        typeof body.pageUrl === 'string'
          ? (() => {
              try {
                return new URL(
                  body.pageUrl.startsWith('http') ? body.pageUrl : `https://${body.pageUrl}`,
                ).hostname.replace(/[^a-zA-Z0-9.-]+/g, '-').slice(0, 40);
              } catch {
                return 'site';
              }
            })()
          : 'site';

      reply
        .header('Content-Type', 'application/zip')
        .header(
          'Content-Disposition',
          `attachment; filename="fitpix-${host || 'site'}-webp.zip"`,
        )
        .header('X-Zip-Included', String(result.included))
        .header('X-Zip-Failed', String(result.failed))
        .header('X-Zip-Skipped-Budget', String(result.skippedBudget))
        .header('X-Zip-Requested', String(result.requested));

      return reply.send(result.zip);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Не удалось собрать архив.';
      const code = /Нет изображений|Не удалось оптимизировать|отфильтрованы/i.test(message)
        ? 422
        : 502;
      if (code >= 500) request.log.error(error);
      return reply.code(code).send({ error: message });
    } finally {
      releaseZipSlot();
    }
  });
}
