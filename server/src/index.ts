import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Fastify from 'fastify';
import { HOST, MAX_FILE_SIZE, PORT } from './config.js';
import { registerAnalyzeRoutes } from './routes/analyze.js';
import { registerBugReportRoutes } from './routes/bugReport.js';
import { registerOptimizeRoutes } from './routes/optimize.js';
import { registerStatic } from './static.js';

export { parseCrop } from './routes/optimize.js';

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(entry);
  } catch {
    return false;
  }
}

export async function buildApp(options?: { logger?: boolean }) {
  const app = Fastify({
    logger: options?.logger ?? true,
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

  app.get('/api/health', async () => ({ ok: true }));

  registerAnalyzeRoutes(app);
  registerOptimizeRoutes(app);
  registerBugReportRoutes(app);
  await registerStatic(app);

  return app;
}

async function main() {
  const app = await buildApp();
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`Images Helper on http://localhost:${PORT}`);
}

if (isDirectRun()) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
