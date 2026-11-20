import { readFileSync } from 'node:fs';

function readPackageVersion(): string {
  const raw = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('version' in parsed) ||
    typeof parsed.version !== 'string' ||
    parsed.version.length === 0
  ) {
    throw new Error('В server/package.json нет поля version');
  }
  return parsed.version;
}

export const VERSION = readPackageVersion();

export function healthPayload(): { ok: true; version: string; uptime: number } {
  return {
    ok: true,
    version: VERSION,
    uptime: Math.floor(process.uptime()),
  };
}
