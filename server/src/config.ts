import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

export const MAX_FILE_SIZE = 30 * 1024 * 1024;
export const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024;
export const PORT = Number(process.env.PORT ?? 3001);
export const HOST = process.env.HOST ?? '0.0.0.0';

export const SMTP_HOST = process.env.SMTP_HOST ?? '';
export const SMTP_PORT = Number(process.env.SMTP_PORT ?? 465);
export const SMTP_USER = process.env.SMTP_USER ?? '';
export const SMTP_PASS = process.env.SMTP_PASS ?? '';
export const SMTP_FROM = process.env.SMTP_FROM ?? SMTP_USER;
export const BUG_REPORT_TO = process.env.BUG_REPORT_TO?.trim() ?? '';

export const ANALYZE_RATE_LIMIT = 8;
export const ANALYZE_RATE_WINDOW_MS = 10 * 60 * 1000;
export const ZIP_RATE_LIMIT = 3;
export const ZIP_RATE_WINDOW_MS = 10 * 60 * 1000;
export const MAX_ACTIVE_ZIP_JOBS = 2;
