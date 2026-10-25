import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import JSZip from 'jszip';
import nodemailer from 'nodemailer';
import {
  ANALYZE_LIMITS,
  analyzePage,
  buildOptimizedZipFromUrls,
} from './analyzePage.js';
import {
  isAllowedMime,
  optimizeAllFormats,
  optimizeArtDirection,
  optimizeImage,
  type BreakpointToken,
  type CropRect,
  type OutputFormat,
  type PrepareOptions,
} from './optimize.js';
import { buildArtDirectionPicture } from './pictureMarkup.js';
import {
  releaseZipSlot,
  takeRateLimitToken,
  tryAcquireZipSlot,
} from './rateLimit.js';
import {
  SPA_PATHS,
  applySeoToHtml,
  normalizePath,
  notFoundPageHtml,
} from './seo.js';

const ANALYZE_RATE_LIMIT = 8;
const ANALYZE_RATE_WINDOW_MS = 10 * 60 * 1000;
const ZIP_RATE_LIMIT = 3;
const ZIP_RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_ACTIVE_ZIP_JOBS = 2;

function clientIp(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim() || request.ip;
  }
  return request.ip;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadLocalEnv(): void {
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../.env'),
    resolve(__dirname, '../../.env'),
  ];

  const envPath = candidates.find((path) => existsSync(path));
  if (!envPath) return;

  // Node 20.12+ / 22+: не перезаписывает уже заданные переменные окружения
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envPath);
    return;
  }

  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadLocalEnv();

const MAX_FILE_SIZE = 30 * 1024 * 1024;
const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024;
const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';
const SMTP_HOST = process.env.SMTP_HOST ?? '';
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 465);
const SMTP_USER = process.env.SMTP_USER ?? '';
const SMTP_PASS = process.env.SMTP_PASS ?? '';
const SMTP_FROM = process.env.SMTP_FROM ?? SMTP_USER;
const BUG_REPORT_TO = process.env.BUG_REPORT_TO ?? 'maaaslanov@gmail.com';

const SCREENSHOT_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function isSmtpConfigured(): boolean {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

async function sendBugReportEmail(report: BugReportUpload): Promise<void> {
  const preview = report.description.slice(0, 80).replace(/\s+/g, ' ');
  const subject = `[Fitpix] Проблема: ${preview}${report.description.length > 80 ? '…' : ''}`;
  const text = [
    'Новое сообщение о проблеме с Fitpix',
    '',
    `Страница: ${report.pageUrl || '—'}`,
    `Контакт: ${report.contactEmail || 'не указан'}`,
    `User-Agent: ${report.userAgent || '—'}`,
    `Скриншот: ${report.screenshot ? report.screenshot.filename : 'нет'}`,
    '',
    'Описание:',
    report.description,
  ].join('\n');

  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  await transport.sendMail({
    from: SMTP_FROM || SMTP_USER,
    to: BUG_REPORT_TO,
    replyTo: report.contactEmail || undefined,
    subject,
    text,
    attachments: report.screenshot
      ? [
          {
            filename: report.screenshot.filename,
            content: report.screenshot.buffer,
            contentType: report.screenshot.mimetype,
          },
        ]
      : undefined,
  });
}

type BugReportUpload = {
  description: string;
  contactEmail: string;
  pageUrl: string;
  userAgent: string;
  screenshot: { buffer: Buffer; filename: string; mimetype: string } | null;
};

async function readBugReportUpload(
  request: FastifyRequest,
): Promise<BugReportUpload | UploadErr> {
  let description = '';
  let contactEmail = '';
  let pageUrl = '';
  let userAgent = '';
  let screenshot: BugReportUpload['screenshot'] = null;
  let truncated = false;

  try {
    for await (const part of request.parts()) {
      if (part.type === 'file') {
        if (part.fieldname !== 'screenshot') {
          await part.toBuffer();
          continue;
        }
        const buffer = await part.toBuffer();
        truncated = part.file.truncated;
        if (!SCREENSHOT_MIMES.has(part.mimetype)) {
          return {
            error: {
              code: 415,
              message: 'Скриншот: допустимы JPEG, PNG, WebP или GIF.',
            },
          };
        }
        if (buffer.length === 0) {
          return { error: { code: 400, message: 'Пустой скриншот.' } };
        }
        if (buffer.length > MAX_SCREENSHOT_SIZE) {
          return {
            error: { code: 413, message: 'Скриншот больше 5 МБ.' },
          };
        }
        screenshot = {
          buffer,
          filename: part.filename || 'screenshot.png',
          mimetype: part.mimetype,
        };
      } else {
        const value = String(part.value ?? '').trim();
        if (part.fieldname === 'description') description = value;
        else if (part.fieldname === 'contactEmail') contactEmail = value;
        else if (part.fieldname === 'pageUrl') pageUrl = value;
        else if (part.fieldname === 'userAgent') userAgent = value;
      }
    }
  } catch (error) {
    request.log.error(error);
    return { error: { code: 400, message: 'Некорректный multipart-запрос.' } };
  }

  if (truncated) {
    return { error: { code: 413, message: 'Скриншот больше 5 МБ.' } };
  }

  if (description.length < 10) {
    return {
      error: {
        code: 400,
        message: 'Опишите проблему подробнее (минимум 10 символов).',
      },
    };
  }

  if (description.length > 4000) {
    return {
      error: { code: 400, message: 'Описание слишком длинное (макс. 4000 символов).' },
    };
  }

  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return { error: { code: 400, message: 'Некорректный email для ответа.' } };
  }

  return { description, contactEmail, pageUrl, userAgent, screenshot };
}

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

type UploadOk = {
  buffer: Buffer;
  filename: string;
  fields: Record<string, string>;
};

type UploadErr = {
  error: { code: 400 | 413 | 415; message: string };
};

function parseFormat(value: unknown): OutputFormat {
  if (value === 'webp' || value === 'avif' || value === 'optimized') {
    return value;
  }
  return 'optimized';
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value === 'true' || value === '1';
  }
  return false;
}

function parseQuality(value: unknown): number {
  const n = Number(value);
  if (Number.isFinite(n)) return n;
  return 80;
}

function parseCrop(fields: Record<string, string>): CropRect | undefined {
  const x = Number(fields.cropX);
  const y = Number(fields.cropY);
  const width = Number(fields.cropWidth);
  const height = Number(fields.cropHeight);

  if (
    [x, y, width, height].every((v) => Number.isFinite(v)) &&
    width > 0 &&
    height > 0
  ) {
    return { x, y, width, height };
  }
  return undefined;
}

function parseCropPrefixed(
  fields: Record<string, string>,
  prefix: string,
): CropRect | undefined {
  const x = Number(fields[`${prefix}X`]);
  const y = Number(fields[`${prefix}Y`]);
  const width = Number(fields[`${prefix}Width`]);
  const height = Number(fields[`${prefix}Height`]);

  if (
    [x, y, width, height].every((v) => Number.isFinite(v)) &&
    width > 0 &&
    height > 0
  ) {
    return { x, y, width, height };
  }
  return undefined;
}

const ART_FILE_FIELDS: Record<string, BreakpointToken> = {
  imageMd: 'md',
  imageLg: 'lg',
  imageXl: 'xl',
};

type ArtUploadOk = {
  files: Partial<Record<BreakpointToken, { buffer: Buffer; filename: string }>>;
  fields: Record<string, string>;
};

async function readArtDirectionUpload(
  request: FastifyRequest,
): Promise<ArtUploadOk | UploadErr> {
  const files: ArtUploadOk['files'] = {};
  const fields: Record<string, string> = {};
  let truncated = false;

  try {
    for await (const part of request.parts()) {
      if (part.type === 'file') {
        const token = ART_FILE_FIELDS[part.fieldname];
        if (!token) {
          await part.toBuffer();
          continue;
        }
        const buffer = await part.toBuffer();
        truncated = truncated || part.file.truncated;
        if (!isAllowedMime(part.mimetype)) {
          return {
            error: {
              code: 415,
              message:
                'Неподдерживаемый тип файла. Допустимы: JPEG, PNG, WebP, AVIF, GIF.',
            },
          };
        }
        if (buffer.length === 0) {
          return { error: { code: 400, message: `Пустой файл для ${token}.` } };
        }
        files[token] = { buffer, filename: part.filename || `${token}.jpg` };
      } else {
        fields[part.fieldname] = String(part.value);
      }
    }
  } catch (error) {
    request.log.error(error);
    return { error: { code: 400, message: 'Некорректный multipart-запрос.' } };
  }

  if (truncated) {
    return { error: { code: 413, message: 'Файл больше 30 МБ.' } };
  }

  if (!files.xl) {
    return {
      error: { code: 400, message: 'Нужен исходник для xl (поле imageXl).' },
    };
  }

  return { files, fields };
}

function parseResizeMaxWidth(fields: Record<string, string>): number | undefined {
  if (!parseBoolean(fields.resize)) return undefined;
  const n = Number(fields.resizeMaxWidth);
  if (!Number.isFinite(n) || n <= 0) return 1920;
  return n;
}

async function readOptimizeUpload(request: FastifyRequest): Promise<UploadOk | UploadErr> {
  let buffer: Buffer | null = null;
  let filename = 'image';
  let mimetype = '';
  const fields: Record<string, string> = {};
  let truncated = false;

  try {
    for await (const part of request.parts()) {
      if (part.type === 'file') {
        if (part.fieldname !== 'image') {
          await part.toBuffer();
          continue;
        }
        filename = part.filename || 'image';
        mimetype = part.mimetype;
        buffer = await part.toBuffer();
        truncated = part.file.truncated;
      } else {
        fields[part.fieldname] = String(part.value);
      }
    }
  } catch (error) {
    request.log.error(error);
    return { error: { code: 400, message: 'Некорректный multipart-запрос.' } };
  }

  if (!buffer) {
    return { error: { code: 400, message: 'Файл не передан. Ожидается поле image.' } };
  }

  if (truncated) {
    return { error: { code: 413, message: 'Файл больше 30 МБ.' } };
  }

  if (!isAllowedMime(mimetype)) {
    return {
      error: {
        code: 415,
        message: 'Неподдерживаемый тип файла. Допустимы: JPEG, PNG, WebP, AVIF, GIF.',
      },
    };
  }

  if (buffer.length === 0) {
    return { error: { code: 400, message: 'Пустой файл.' } };
  }

  return { buffer, filename, fields };
}

function prepareOptionsFromFields(fields: Record<string, string>): PrepareOptions {
  return {
    trim: parseBoolean(fields.trim),
    quality: parseQuality(fields.quality),
    crop: parseCrop(fields),
    resizeMaxWidth: parseResizeMaxWidth(fields),
  };
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

async function main() {
  const app = Fastify({
    logger: true,
    bodyLimit: MAX_FILE_SIZE * 3,
  });

  await app.register(cors, {
    origin: true,
    exposedHeaders: [
      'Content-Disposition',
      'X-Original-Size',
      'X-Optimized-Size',
      'X-Width',
      'X-Height',
      'X-Original-Width',
      'X-Original-Height',
      'X-Extension',
      'X-Tokens',
      'X-Has-2x',
      'X-Fallback-Extension',
      'X-Img-Width',
      'X-Img-Height',
      'X-Zip-Included',
      'X-Zip-Failed',
      'X-Zip-Skipped-Budget',
      'X-Zip-Requested',
    ],
  });

  await app.register(multipart, {
    limits: {
      fileSize: MAX_FILE_SIZE,
      files: 3,
      fields: 40,
    },
  });

  app.get('/api/health', async () => ({ ok: true }));

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

  app.post('/api/optimize', async (request, reply) => {
    const upload = await readOptimizeUpload(request);
    if ('error' in upload) {
      return reply.code(upload.error.code).send({ error: upload.error.message });
    }

    const { buffer, filename, fields } = upload;

    try {
      const result = await optimizeImage(buffer, buffer.length, {
        format: parseFormat(fields.format),
        ...prepareOptionsFromFields(fields),
      });

      const baseName = sanitizeBaseName(filename, 'image');

      reply
        .header('Content-Type', result.contentType)
        .header(
          'Content-Disposition',
          `inline; filename="${baseName}.${result.extension}"`,
        )
        .header('X-Original-Size', String(result.originalSize))
        .header('X-Optimized-Size', String(result.optimizedSize))
        .header('X-Width', String(result.width))
        .header('X-Height', String(result.height))
        .header('X-Original-Width', String(result.originalWidth))
        .header('X-Original-Height', String(result.originalHeight))
        .header('X-Extension', result.extension);

      return reply.send(result.buffer);
    } catch (error) {
      request.log.error(error);
      return reply.code(422).send({
        error: 'Не удалось обработать изображение. Проверьте файл и параметры обрезки.',
      });
    }
  });

  app.post('/api/optimize-all', async (request, reply) => {
    const upload = await readOptimizeUpload(request);
    if ('error' in upload) {
      return reply.code(upload.error.code).send({ error: upload.error.message });
    }

    const { buffer, filename, fields } = upload;
    const baseName = sanitizeBaseName(filename, 'image');

    try {
      const variants = await optimizeAllFormats(
        buffer,
        buffer.length,
        prepareOptionsFromFields(fields),
      );

      const zip = new JSZip();
      const usedNames = new Set<string>();
      for (const variant of variants) {
        const name = `${baseName}.${variant.extension}`;
        if (usedNames.has(name)) continue;
        usedNames.add(name);
        zip.file(name, variant.buffer);
      }

      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'STORE',
      });

      reply
        .header('Content-Type', 'application/zip')
        .header(
          'Content-Disposition',
          `attachment; filename="${baseName}.zip"`,
        );

      return reply.send(zipBuffer);
    } catch (error) {
      request.log.error(error);
      return reply.code(422).send({
        error: 'Не удалось обработать изображение. Проверьте файл и параметры обрезки.',
      });
    }
  });

  app.post('/api/bug-report', async (request, reply) => {
    if (!isSmtpConfigured()) {
      return reply.code(503).send({
        error: 'Отправка сообщений временно недоступна: не настроен SMTP.',
      });
    }

    const upload = await readBugReportUpload(request);
    if ('error' in upload) {
      return reply.code(upload.error.code).send({ error: upload.error.message });
    }

    try {
      await sendBugReportEmail(upload);
      return reply.send({ ok: true });
    } catch (error) {
      request.log.error(error);
      return reply.code(502).send({
        error: 'Не удалось отправить сообщение. Попробуйте позже.',
      });
    }
  });

  app.post('/api/optimize-responsive', async (request, reply) => {
    const upload = await readArtDirectionUpload(request);
    if ('error' in upload) {
      return reply.code(upload.error.code).send({ error: upload.error.message });
    }

    const { files, fields } = upload;
    const xlName = files.xl?.filename.replace(/\.[^.]+$/, '') || 'image';
    const baseName = sanitizeBaseName(fields.baseName, xlName);

    const slots: { token: BreakpointToken; buffer: Buffer; crop?: CropRect }[] = [];
    for (const token of ['md', 'lg', 'xl'] as BreakpointToken[]) {
      const file = files[token];
      if (!file) continue;
      slots.push({
        token,
        buffer: file.buffer,
        crop: parseCropPrefixed(fields, `crop${token[0].toUpperCase()}${token.slice(1)}`),
      });
    }

    try {
      const result = await optimizeArtDirection(slots, {
        trim: parseBoolean(fields.trim),
        quality: parseQuality(fields.quality),
        baseName,
      });

      const picture = buildArtDirectionPicture({
        baseName,
        tokens: result.tokens,
        has2x: result.has2x,
        fallbackExtension: result.fallbackExtension,
        imgWidth: result.imgWidth,
        imgHeight: result.imgHeight,
      });

      const zip = new JSZip();
      for (const file of result.files) {
        zip.file(file.filename, file.buffer);
      }
      zip.file('picture.html', picture);

      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'STORE',
      });

      const has2xHeader = result.tokens
        .filter((token) => result.has2x[token])
        .join(',');

      reply
        .header('Content-Type', 'application/zip')
        .header(
          'Content-Disposition',
          `attachment; filename="${baseName}-responsive.zip"`,
        )
        .header('X-Tokens', result.tokens.join(','))
        .header('X-Has-2x', has2xHeader)
        .header('X-Fallback-Extension', result.fallbackExtension)
        .header('X-Img-Width', String(result.imgWidth || ''))
        .header('X-Img-Height', String(result.imgHeight || ''));

      return reply.send(zipBuffer);
    } catch (error) {
      request.log.error(error);
      return reply.code(422).send({
        error: 'Не удалось обработать изображение. Проверьте файл и параметры обрезки.',
      });
    }
  });

  const staticDir = resolveStaticDir();
  if (staticDir) {
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

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`Images Helper on http://localhost:${PORT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
