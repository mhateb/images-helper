import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyRequest } from 'fastify';
import JSZip from 'jszip';
import {
  isAllowedMime,
  optimizeAllFormats,
  optimizeImage,
  type CropRect,
  type OutputFormat,
  type PrepareOptions,
} from './optimize.js';

const MAX_FILE_SIZE = 30 * 1024 * 1024;
const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';
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

async function main() {
  const app = Fastify({
    logger: true,
    bodyLimit: MAX_FILE_SIZE,
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
    ],
  });

  await app.register(multipart, {
    limits: {
      fileSize: MAX_FILE_SIZE,
      files: 1,
      fields: 20,
    },
  });

  app.get('/api/health', async () => ({ ok: true }));

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

      const baseName = filename.replace(/\.[^.]+$/, '') || 'image';

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
        error: 'Не удалось обработать изображение. Проверьте файл и параметры кропа.',
      });
    }
  });

  app.post('/api/optimize-all', async (request, reply) => {
    const upload = await readOptimizeUpload(request);
    if ('error' in upload) {
      return reply.code(upload.error.code).send({ error: upload.error.message });
    }

    const { buffer, filename, fields } = upload;
    const baseName = filename.replace(/\.[^.]+$/, '') || 'image';

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
        error: 'Не удалось обработать изображение. Проверьте файл и параметры кропа.',
      });
    }
  });

  const staticDir = resolveStaticDir();
  if (staticDir) {
    await app.register(fastifyStatic, {
      root: staticDir,
      wildcard: false,
    });

    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.code(404).send({ error: 'Not found' });
      }
      return reply.sendFile('index.html');
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
