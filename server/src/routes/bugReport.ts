import type { FastifyInstance, FastifyRequest } from 'fastify';
import { BUG_REPORT_TO, MAX_SCREENSHOT_SIZE } from '../config.js';
import {
  isSmtpConfigured,
  sendBugReportEmail,
  type BugReportUpload,
} from '../services/mailer.js';

const SCREENSHOT_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

type UploadErr = {
  error: { code: 400 | 413 | 415; message: string };
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

export function registerBugReportRoutes(app: FastifyInstance): void {
  app.post('/api/bug-report', async (request, reply) => {
    if (!isSmtpConfigured() || !BUG_REPORT_TO) {
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
}
