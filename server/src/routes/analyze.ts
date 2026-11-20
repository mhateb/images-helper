import type { FastifyInstance } from 'fastify';
import {
  ANALYZE_LIMITS,
  analyzePage,
  buildOptimizedZipFromUrls,
  fetchRemoteImage,
} from '../analyzePage.js';
import { ValidationError } from '../errors.js';
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
    const ip = request.ip;
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

    const result = await analyzePage(rawUrl);
    return reply.send(result);
  });

  app.post('/api/analyze-fetch-image', async (request, reply) => {
    const ip = request.ip;
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
      throw new ValidationError('Укажите URL изображения.');
    }

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
  });

  app.post('/api/analyze-download-zip', async (request, reply) => {
    const ip = request.ip;
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
      throw new ValidationError('Передайте список URL изображений.');
    }

    if (urls.length > ANALYZE_LIMITS.maxZipImages) {
      releaseZipSlot();
      throw new ValidationError(
        `В архив можно положить не больше ${ANALYZE_LIMITS.maxZipImages} изображений.`,
      );
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
              } catch (error) {
                request.log.debug({ err: error }, 'zip filename host fallback');
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
    } finally {
      releaseZipSlot();
    }
  });
}
