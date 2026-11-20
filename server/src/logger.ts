import { AsyncLocalStorage } from 'node:async_hooks';
import type { FastifyBaseLogger, FastifyInstance, FastifyServerOptions } from 'fastify';
import './config.js';

const LEVELS = new Set(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);

const requestLog = new AsyncLocalStorage<FastifyBaseLogger>();

let root: FastifyBaseLogger | undefined;

const noop = () => {};

const fallback = {
  level: 'silent',
  fatal: noop,
  error: noop,
  warn: noop,
  info: noop,
  debug: noop,
  trace: noop,
  silent: noop,
  child() {
    return fallback;
  },
} as unknown as FastifyBaseLogger;

export function writeBootstrap(
  level: 20 | 30 | 40 | 50 | 60,
  message: string,
  error?: unknown,
  fields?: Record<string, unknown>,
): void {
  const payload: Record<string, unknown> = {
    level,
    time: Date.now(),
    msg: message,
    ...fields,
  };
  if (error !== undefined) {
    payload.err =
      error instanceof Error
        ? { type: error.name, message: error.message, stack: error.stack }
        : { message: String(error) };
  }
  process.stderr.write(`${JSON.stringify(payload)}\n`);
}

export function resolveLogLevel(): string {
  const raw = process.env.LOG_LEVEL?.trim().toLowerCase() ?? '';
  if (LEVELS.has(raw)) return raw;
  if (raw) {
    writeBootstrap(40, 'unknown LOG_LEVEL, using default', undefined, { value: raw });
  }
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

type LoggerConfig = Exclude<NonNullable<FastifyServerOptions['logger']>, boolean>;

export function loggerConfig(): LoggerConfig {
  return {
    level: resolveLogLevel(),
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-api-key"]',
        '*.password',
        '*.pass',
        '*.smtpPass',
      ],
      censor: '[redacted]',
    },
  };
}

/** Корень и лог текущего запроса пишут в один и тот же pino-поток. */
export function attachLogger(app: FastifyInstance): void {
  root = app.log;
  app.addHook('onRequest', (request, _reply, done) => {
    requestLog.run(request.log, () => {
      done();
    });
  });
}

export function log(): FastifyBaseLogger {
  return requestLog.getStore() ?? root ?? fallback;
}

/** Адрес для лога без query и фрагмента: там бывают токены. */
export function publicUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch (error) {
    log().debug({ err: error }, 'unparseable url in log');
    return '[invalid-url]';
  }
}
