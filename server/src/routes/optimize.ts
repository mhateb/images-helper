import type { FastifyInstance, FastifyRequest } from 'fastify';
import JSZip from 'jszip';
import {
  isAllowedMime,
  optimizeAllFormats,
  optimizeArtDirection,
  optimizeImage,
  type BreakpointToken,
  type CropRect,
  type OutputFormat,
  type PrepareOptions,
} from '../optimize.js';
import { buildArtDirectionPicture } from '../pictureMarkup.js';

type UploadOk = {
  buffer: Buffer;
  filename: string;
  fields: Record<string, string>;
};

type UploadErr = {
  error: { code: 400 | 413 | 415; message: string };
};

type ArtUploadOk = {
  files: Partial<Record<BreakpointToken, { buffer: Buffer; filename: string }>>;
  fields: Record<string, string>;
};

const ART_FILE_FIELDS: Record<string, BreakpointToken> = {
  imageMd: 'md',
  imageLg: 'lg',
  imageXl: 'xl',
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

export function parseCrop(fields: Record<string, string>): CropRect | undefined {
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

function parseResizeMaxWidth(fields: Record<string, string>): number | undefined {
  if (!parseBoolean(fields.resize)) return undefined;
  const n = Number(fields.resizeMaxWidth);
  if (!Number.isFinite(n) || n <= 0) return 1920;
  return n;
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

export function registerOptimizeRoutes(app: FastifyInstance): void {
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
}
