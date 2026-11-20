import './sharpLimit.js';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Fastify, { type FastifyServerOptions } from 'fastify';
import { HOST, MAX_FILE_SIZE, PORT, TRUST_PROXY } from './config.js';
import { UpstreamError, ValidationError } from './errors.js';
import { attachLogger, loggerConfig, writeBootstrap } from './logger.js';
import { startRateLimitCleanup, stopRateLimitCleanup } from './rateLimit.js';
import { registerAnalyzeRoutes } from './routes/analyze.js';
import { registerBugReportRoutes } from './routes/bugReport.js';
import { registerOptimizeRoutes } from './routes/optimize.js';
import { registerSecurity } from './security.js';
import { registerGracefulShutdown } from './shutdown.js';
import { registerStatic } from './static.js';
import { healthPayload } from './version.js';

export { parseCrop } from './routes/optimize.js';

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(entry);
  } catch (error) {
    writeBootstrap(40, 'entry path check failed', error);
    return false;
  }
}

export async function buildApp(options?: { logger?: FastifyServerOptions['logger'] }) {
  const app = Fastify({
    logger: options?.logger ?? loggerConfig(),
    bodyLimit: MAX_FILE_SIZE * 3,
    // X-Forwarded-For учитывается, только если сокет принадлежит доверенному прокси.
    trustProxy: TRUST_PROXY,
    // На shutdown закрываем простаивающие keep-alive, текущие запросы дорабатывают.
    forceCloseConnections: 'idle',
  });
  attachLogger(app);

  await registerSecurity(app);

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
      'X-Extension',
      'X-File-Name',
    ],
  });

  await app.register(multipart, {
    limits: {
      fileSize: MAX_FILE_SIZE,
      files: 3,
      fields: 40,
    },
  });

  // Контекст маршрута запоминает обработчик в момент регистрации.
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ValidationError) {
      request.log.info({ err: error, statusCode: error.statusCode }, 'validation failed');
      reply.code(error.statusCode).send({ error: error.message });
      return;
    }

    if (error instanceof UpstreamError) {
      const fields = { err: error, statusCode: error.statusCode };
      if (error.statusCode >= 500) request.log.error(fields, 'upstream failed');
      else request.log.warn(fields, 'upstream rejected');
      reply.code(error.statusCode).send({ error: error.message });
      return;
    }

    const statusCode =
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof error.statusCode === 'number'
        ? error.statusCode
        : 500;
    if (statusCode >= 500) request.log.error({ err: error, statusCode }, 'request failed');
    else request.log.warn({ err: error, statusCode }, 'request rejected');
    reply.send(error);
  });

  app.get('/api/health', async (_request, reply) => {
    reply.header('cache-control', 'no-store');
    return healthPayload();
  });

  registerAnalyzeRoutes(app);
  registerOptimizeRoutes(app);
  registerBugReportRoutes(app);
  await registerStatic(app);

  app.addHook('onClose', async () => {
    stopRateLimitCleanup();
  });
  startRateLimitCleanup();

  return app;
}

async function main() {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;
  try {
    app = await buildApp();
    await app.listen({ port: PORT, host: HOST });
    registerGracefulShutdown(app);
    app.log.info({ port: PORT, host: HOST }, 'server listening');
  } catch (error) {
    if (app) {
      app.log.fatal({ err: error }, 'server failed to start');
      try {
        await app.close();
      } catch (closeError) {
        app.log.error({ err: closeError }, 'close after startup failure failed');
      }
    } else {
      writeBootstrap(60, 'server failed to start', error);
    }
    process.exit(1);
  }
}

if (isDirectRun()) {
  void main();
}
