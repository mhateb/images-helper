import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import { buildApp } from '../src/index.js';

function multipart(
  fields: Record<string, string>,
  file?: { filename: string; contentType: string; data: Buffer },
) {
  const boundary = '----fitpixform';
  const chunks: Buffer[] = [];
  const push = (value: string) => {
    chunks.push(Buffer.from(value, 'utf8'));
  };

  for (const [name, value] of Object.entries(fields)) {
    push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
    );
  }

  if (file) {
    push(
      `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`,
    );
    chunks.push(file.data);
    push('\r\n');
  }

  push(`--${boundary}--\r\n`);

  return {
    payload: Buffer.concat(chunks),
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
  };
}

async function png(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 220, g: 40, b: 40 },
    },
  })
    .png()
    .toBuffer();
}

describe('POST /api/optimize', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  it('отвечает 400, если файл не передан', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/optimize',
      ...multipart({ format: 'webp' }),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'Файл не передан. Ожидается поле image.',
    });
  });

  it('отвечает 415 на неподдерживаемый тип', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/optimize',
      ...multipart({}, {
        filename: 'notes.txt',
        contentType: 'text/plain',
        data: Buffer.from('hello'),
      }),
    });

    expect(response.statusCode).toBe(415);
    expect(response.json()).toEqual({
      error: 'Неподдерживаемый тип файла. Допустимы: JPEG, PNG, WebP, AVIF, GIF.',
    });
  });

  it('отвечает 400 на пустой файл', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/optimize',
      ...multipart({}, {
        filename: 'empty.png',
        contentType: 'image/png',
        data: Buffer.alloc(0),
      }),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'Пустой файл.' });
  });

  it('отвечает 422, если байты не являются картинкой', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/optimize',
      ...multipart({ format: 'optimized', quality: '80' }, {
        filename: 'broken.jpg',
        contentType: 'image/jpeg',
        data: Buffer.from('this is not a jpeg'),
      }),
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: 'Не удалось обработать изображение. Проверьте файл и параметры обрезки.',
    });
  });

  it('возвращает сжатый PNG и заголовки размеров', async () => {
    const image = await png(80, 40);
    const response = await app.inject({
      method: 'POST',
      url: '/api/optimize',
      ...multipart({ format: 'optimized', quality: '80', trim: 'false' }, {
        filename: 'my photo.png',
        contentType: 'image/png',
        data: image,
      }),
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/png');
    expect(response.headers['x-extension']).toBe('png');
    expect(response.headers['x-original-size']).toBe(String(image.length));
    expect(response.headers['x-width']).toBe('80');
    expect(response.headers['x-height']).toBe('40');
    expect(response.headers['x-original-width']).toBe('80');
    expect(response.headers['x-original-height']).toBe('40');
    expect(response.headers['content-disposition']).toBe(
      'inline; filename="my-photo.png"',
    );
    expect(response.rawPayload.subarray(0, 4).toString('hex')).toBe('89504e47');
    expect(Number(response.headers['x-optimized-size'])).toBe(response.rawPayload.length);
  });

  it('кодирует результат в WebP', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/optimize',
      ...multipart({ format: 'webp', quality: '60' }, {
        filename: 'dot.png',
        contentType: 'image/png',
        data: await png(32, 32),
      }),
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/webp');
    expect(response.headers['x-extension']).toBe('webp');
    expect(response.rawPayload.subarray(0, 4).toString()).toBe('RIFF');
    expect(response.rawPayload.subarray(8, 12).toString()).toBe('WEBP');
  });

  it('обрезает по crop-полям и уменьшает по resizeMaxWidth', async () => {
    const cropped = await app.inject({
      method: 'POST',
      url: '/api/optimize',
      ...multipart(
        {
          format: 'optimized',
          quality: '80',
          cropX: '10',
          cropY: '5',
          cropWidth: '30',
          cropHeight: '20',
        },
        {
          filename: 'frame.png',
          contentType: 'image/png',
          data: await png(120, 80),
        },
      ),
    });

    expect(cropped.statusCode).toBe(200);
    expect(cropped.headers['x-original-width']).toBe('120');
    expect(cropped.headers['x-original-height']).toBe('80');
    expect(cropped.headers['x-width']).toBe('30');
    expect(cropped.headers['x-height']).toBe('20');

    const resized = await app.inject({
      method: 'POST',
      url: '/api/optimize',
      ...multipart(
        {
          format: 'webp',
          quality: '70',
          resize: 'true',
          resizeMaxWidth: '50',
        },
        {
          filename: 'wide.png',
          contentType: 'image/png',
          data: await png(200, 100),
        },
      ),
    });

    expect(resized.statusCode).toBe(200);
    expect(resized.headers['x-width']).toBe('50');
    expect(resized.headers['x-height']).toBe('25');
    expect(resized.headers['x-original-width']).toBe('200');
    expect(resized.headers['content-type']).toBe('image/webp');
  });
});
