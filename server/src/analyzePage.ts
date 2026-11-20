import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from 'node:dns';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import JSZip from 'jszip';
import sharp from 'sharp';
import { Agent, fetch } from 'undici';
import { UpstreamError, ValidationError } from './errors.js';
import { log, publicUrl } from './logger.js';
import { optimizeAllFormats, optimizeImage, type OutputFormat } from './optimize.js';
import { withSharpLimit } from './sharpLimit.js';

const PAGE_TIMEOUT_MS = 12_000;
const IMAGE_TIMEOUT_MS = 10_000;
const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGES = 40;
const MAX_ZIP_IMAGES = 20;
const MAX_ZIP_SOURCE_BYTES = 40 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const FETCH_CONCURRENCY = 6;
const ZIP_CONCURRENCY = 4;
const ESTIMATE_QUALITY = 80;
const USER_AGENT = 'FitpixPageAnalyzer/1.0 (+https://fitpix.ru)';
const LOCAL_HOST_MESSAGE = 'Нельзя анализировать локальные адреса.';
const PRIVATE_IP_MESSAGE = 'Нельзя анализировать внутренние IP-адреса.';
const PRIVATE_NAME_MESSAGE = 'Домен указывает на внутренний адрес — анализ недоступен.';
const DNS_FAILURE_MESSAGE = 'Не удалось разрешить домен страницы.';
const BLOCKED_ADDRESS_CODE = 'EBLOCKEDIP';

export const ANALYZE_LIMITS = {
  maxAnalyzeImages: MAX_IMAGES,
  maxZipImages: MAX_ZIP_IMAGES,
  maxZipSourceBytes: MAX_ZIP_SOURCE_BYTES,
} as const;

export type FormatEstimate = {
  optimizedBytes: number;
  savedBytes: number;
  savedPercent: number;
};

export type FormatEstimates = {
  optimized: FormatEstimate;
  webp: FormatEstimate;
  avif: FormatEstimate;
};

export type AnalyzedImage = {
  url: string;
  fileName: string;
  originalBytes: number;
  /** Primary estimate used for sorting / ZIP (WebP). */
  optimizedBytes: number;
  savedBytes: number;
  savedPercent: number;
  estimates: FormatEstimates;
  width: number;
  height: number;
  contentType: string;
  thumbnailDataUrl: string | null;
  error: string | null;
};

export type AnalyzePageResult = {
  url: string;
  finalUrl: string;
  imageCount: number;
  analyzedCount: number;
  skippedCount: number;
  truncated: boolean;
  totalBytes: number;
  /** Primary (WebP) totals for backward-compatible fields. */
  optimizedBytes: number;
  savedBytes: number;
  savedPercent: number;
  estimates: FormatEstimates;
  bestFormat: OutputFormat;
  images: AnalyzedImage[];
};

function emptyEstimate(): FormatEstimate {
  return { optimizedBytes: 0, savedBytes: 0, savedPercent: 0 };
}

function emptyEstimates(): FormatEstimates {
  return {
    optimized: emptyEstimate(),
    webp: emptyEstimate(),
    avif: emptyEstimate(),
  };
}

function estimateFromSizes(originalBytes: number, candidateBytes: number): FormatEstimate {
  const optimizedBytes = Math.min(candidateBytes, originalBytes);
  const savedBytes = Math.max(0, originalBytes - optimizedBytes);
  const savedPercent =
    originalBytes > 0 ? Math.round((savedBytes / originalBytes) * 100) : 0;
  return { optimizedBytes, savedBytes, savedPercent };
}

function sumEstimates(
  images: AnalyzedImage[],
  key: keyof FormatEstimates,
  totalBytes: number,
): FormatEstimate {
  const optimizedBytes = images.reduce(
    (sum, item) => sum + item.estimates[key].optimizedBytes,
    0,
  );
  const savedBytes = Math.max(0, totalBytes - optimizedBytes);
  const savedPercent = totalBytes > 0 ? Math.round((savedBytes / totalBytes) * 100) : 0;
  return { optimizedBytes, savedBytes, savedPercent };
}

function pickBestFormat(estimates: FormatEstimates): OutputFormat {
  const ranked: OutputFormat[] = ['avif', 'webp', 'optimized'];
  let best: OutputFormat = 'webp';
  let bestSaved = -1;
  for (const format of ranked) {
    if (estimates[format].savedBytes > bestSaved) {
      bestSaved = estimates[format].savedBytes;
      best = format;
    }
  }
  return best;
}

export function isPrivateIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }

  if (version === 6) {
    const normalized = ip.toLowerCase();
    if (normalized === '::' || normalized === '::1') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA
    if (normalized.startsWith('fe80')) return true; // link-local
    if (normalized.startsWith('ff')) return true; // multicast
    // IPv4-mapped :ffff:x.x.x.x
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }

  return true;
}

function normalizedHost(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, '').toLowerCase();
}

function isLocalHostname(host: string): boolean {
  return !host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local');
}

function blockedAddress(message: string): NodeJS.ErrnoException {
  const error = new Error(message) as NodeJS.ErrnoException;
  error.name = 'BlockedAddressError';
  error.code = BLOCKED_ADDRESS_CODE;
  return error;
}

type PublicLookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

function rejectLookup(callback: PublicLookupCallback, error: NodeJS.ErrnoException): void {
  // При ошибке сокет смотрит только на неё. Пустой список адресов не используется.
  callback(error, []);
}

/**
 * Lookup, который вызывает сокет. Возвращённый адрес и есть адрес соединения:
 * после callback имя больше не резолвится.
 */
export function lookupPublicAddress(
  hostname: string,
  options: LookupOptions,
  callback: PublicLookupCallback,
): void {
  const host = normalizedHost(hostname);
  if (isLocalHostname(host)) {
    rejectLookup(callback, blockedAddress(LOCAL_HOST_MESSAGE));
    return;
  }

  const literalFamily = isIP(host);
  if (literalFamily === 4 || literalFamily === 6) {
    if (isPrivateIp(host)) {
      rejectLookup(callback, blockedAddress(PRIVATE_IP_MESSAGE));
      return;
    }
    if (options.all) {
      callback(null, [{ address: host, family: literalFamily }]);
      return;
    }
    callback(null, host, literalFamily);
    return;
  }

  dnsLookup(
    host,
    { family: options.family, hints: options.hints, all: true, verbatim: true },
    (error, addresses) => {
      if (error) {
        rejectLookup(callback, error);
        return;
      }
      if (!Array.isArray(addresses) || addresses.length === 0) {
        const failure = new Error(DNS_FAILURE_MESSAGE) as NodeJS.ErrnoException;
        failure.code = 'ENOTFOUND';
        rejectLookup(callback, failure);
        return;
      }
      for (const record of addresses) {
        if (isPrivateIp(record.address)) {
          rejectLookup(callback, blockedAddress(PRIVATE_NAME_MESSAGE));
          return;
        }
      }
      if (options.all) {
        callback(null, addresses);
        return;
      }
      callback(null, addresses[0].address, addresses[0].family);
    },
  );
}

// Ранний assertPublicHostname и этот lookup — два разных DNS-запроса.
const publicDispatcher = new Agent({
  connect: {
    lookup: lookupPublicAddress,
  },
});

function findCause(
  error: unknown,
  predicate: (value: Error & NodeJS.ErrnoException) => boolean,
): (Error & NodeJS.ErrnoException) | null {
  const seen = new Set<unknown>();
  const pending: unknown[] = [error];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);
    if (current instanceof Error && predicate(current)) return current;

    const record = current as { cause?: unknown; errors?: unknown };
    if (record.cause) pending.push(record.cause);
    if (Array.isArray(record.errors)) pending.push(...record.errors);
  }

  return null;
}

async function assertPublicHostname(hostname: string): Promise<void> {
  const host = normalizedHost(hostname);
  if (isLocalHostname(host)) {
    throw new ValidationError(LOCAL_HOST_MESSAGE);
  }

  if (isIP(host)) {
    if (isPrivateIp(host)) {
      throw new ValidationError(PRIVATE_IP_MESSAGE);
    }
    return;
  }

  let records: { address: string; family: number }[];
  try {
    records = await lookup(host, { all: true, verbatim: true });
  } catch (error) {
    throw new UpstreamError(DNS_FAILURE_MESSAGE, 422, {
      cause: error,
      details: { hostname: host },
    });
  }

  if (records.length === 0) {
    throw new UpstreamError(DNS_FAILURE_MESSAGE, 422);
  }

  for (const record of records) {
    if (isPrivateIp(record.address)) {
      throw new ValidationError(PRIVATE_NAME_MESSAGE);
    }
  }
}

export type FetchedRemoteImage = {
  buffer: Buffer;
  contentType: string;
  fileName: string;
  finalUrl: string;
};

/** Fetch a single public image with SSRF guards — for tool handoff. */
export async function fetchRemoteImage(rawUrl: string): Promise<FetchedRemoteImage> {
  const target = await normalizePageUrl(rawUrl);
  const fetched = await fetchWithLimits(target, {
    timeoutMs: IMAGE_TIMEOUT_MS,
    maxBytes: MAX_IMAGE_BYTES,
    accept: 'image/*,*/*;q=0.8',
  });

  const contentType = guessMime(rawUrl, fetched.contentType);
  if (!contentType.startsWith('image/')) {
    throw new ValidationError('По ссылке не изображение.');
  }
  if (contentType === 'image/svg+xml') {
    throw new ValidationError('SVG лучше открывать в инструменте вручную.');
  }

  return {
    buffer: fetched.buffer,
    contentType,
    fileName: fileNameFromUrl(fetched.finalUrl || rawUrl),
    finalUrl: fetched.finalUrl,
  };
}

export async function normalizePageUrl(raw: string): Promise<URL> {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new ValidationError('Укажите URL страницы.');
  }

  let withProtocol = trimmed;
  if (!/^https?:\/\//i.test(withProtocol)) {
    withProtocol = `https://${withProtocol}`;
  }

  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch (error) {
    throw new ValidationError('Некорректный URL.', { cause: error });
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ValidationError('Допустимы только ссылки http и https.');
  }

  if (url.username || url.password) {
    throw new ValidationError('URL с логином и паролем не поддерживается.');
  }

  await assertPublicHostname(url.hostname);
  return url;
}

async function fetchWithLimits(
  url: URL,
  options: {
    timeoutMs: number;
    maxBytes: number;
    accept: string;
  },
): Promise<{ buffer: Buffer; contentType: string; finalUrl: string }> {
  let current = url;

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    await assertPublicHostname(current.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const response = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        dispatcher: publicDispatcher,
        headers: {
          Accept: options.accept,
          'User-Agent': USER_AGENT,
        },
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) {
          throw new UpstreamError('Редирект без адреса Location.', 422);
        }
        current = new URL(location, current);
        if (current.protocol !== 'http:' && current.protocol !== 'https:') {
          throw new UpstreamError('Небезопасный редирект.', 422);
        }
        continue;
      }

      if (!response.ok) {
        throw new UpstreamError(`Страница ответила кодом ${response.status}.`, 422);
      }

      if (!response.body) {
        throw new UpstreamError('Пустой ответ сервера.');
      }

      const contentType = (response.headers.get('content-type') || '').split(';')[0].trim();
      const chunks: Buffer[] = [];
      let total = 0;
      const reader = response.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > options.maxBytes) {
          const url = `${current.origin}${current.pathname}`;
          void reader.cancel().catch((cancelError: unknown) => {
            log().debug({ err: cancelError, url }, 'response body cancel failed');
          });
          throw new UpstreamError('Ответ слишком большой для анализа.', 422, {
            details: { url },
          });
        }
        chunks.push(Buffer.from(value));
      }

      return {
        buffer: Buffer.concat(chunks),
        contentType,
        finalUrl: current.toString(),
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof UpstreamError) {
        throw error;
      }
      const url = `${current.origin}${current.pathname}`;
      const blocked = findCause(error, (value) => value.code === BLOCKED_ADDRESS_CODE);
      if (blocked) {
        throw new ValidationError(blocked.message, { cause: error, details: { url } });
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new UpstreamError('Превышено время ожидания ответа.', 422, {
          cause: error,
          details: { url },
        });
      }
      if (findCause(error, (value) => value.code === 'ENOTFOUND' || value.code === 'EAI_AGAIN')) {
        throw new UpstreamError(DNS_FAILURE_MESSAGE, 422, {
          cause: error,
          details: { url },
        });
      }
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Не удалось получить ответ.';
      throw new UpstreamError(message, 502, { cause: error, details: { url } });
    } finally {
      clearTimeout(timer);
    }
  }

  throw new UpstreamError('Слишком много редиректов.', 422);
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function addCandidate(urls: Set<string>, raw: string, base: URL) {
  const cleaned = decodeHtmlEntities(raw.trim());
  if (!cleaned || cleaned.startsWith('data:') || cleaned.startsWith('blob:')) return;
  if (cleaned.startsWith('#')) return;

  try {
    const absolute = new URL(cleaned, base);
    if (absolute.protocol !== 'http:' && absolute.protocol !== 'https:') return;
    absolute.hash = '';
    urls.add(absolute.toString());
  } catch (error) {
    log().debug({ err: error }, 'skipped invalid image url');
  }
}

function parseSrcset(srcset: string, base: URL, urls: Set<string>) {
  for (const part of srcset.split(',')) {
    const candidate = part.trim().split(/\s+/)[0];
    if (candidate) addCandidate(urls, candidate, base);
  }
}

export function extractImageUrls(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const urls = new Set<string>();

  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const src = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
    if (src) addCandidate(urls, src, base);
    const dataSrc = tag.match(/\bdata-src\s*=\s*["']([^"']+)["']/i)?.[1];
    if (dataSrc) addCandidate(urls, dataSrc, base);
    const srcset = tag.match(/\bsrcset\s*=\s*["']([^"']+)["']/i)?.[1];
    if (srcset) parseSrcset(srcset, base, urls);
  }

  for (const match of html.matchAll(/<source\b[^>]*>/gi)) {
    const tag = match[0];
    const srcset = tag.match(/\bsrcset\s*=\s*["']([^"']+)["']/i)?.[1];
    if (srcset) parseSrcset(srcset, base, urls);
    const src = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
    if (src) addCandidate(urls, src, base);
  }

  for (const match of html.matchAll(
    /<meta\b[^>]*\bproperty\s*=\s*["']og:image(?::secure_url)?["'][^>]*>/gi,
  )) {
    const content = match[0].match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1];
    if (content) addCandidate(urls, content, base);
  }

  for (const match of html.matchAll(/\bstyle\s*=\s*["']([^"']+)["']/gi)) {
    for (const urlMatch of match[1].matchAll(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi)) {
      const candidate = urlMatch[2];
      if (/\.(avif|gif|jpe?g|png|webp|svg)(\?|#|$)/i.test(candidate)) {
        addCandidate(urls, candidate, base);
      }
    }
  }

  return [...urls];
}

function fileNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const base = pathname.split('/').filter(Boolean).pop() || 'image';
    return decodeURIComponent(base).slice(0, 120);
  } catch (error) {
    log().debug({ err: error }, 'image file name fallback');
    return 'image';
  }
}

function guessMime(url: string, headerMime: string): string {
  if (headerMime.startsWith('image/')) return headerMime;
  const lower = url.toLowerCase();
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  if (lower.includes('.avif')) return 'image/avif';
  if (lower.includes('.gif')) return 'image/gif';
  if (lower.includes('.svg')) return 'image/svg+xml';
  if (lower.includes('.jpg') || lower.includes('.jpeg')) return 'image/jpeg';
  return headerMime || 'application/octet-stream';
}

async function makeThumbnail(buffer: Buffer): Promise<string | null> {
  try {
    const thumb = await withSharpLimit(() =>
      sharp(buffer, { failOn: 'none', animated: false })
        .rotate()
        .resize({ width: 72, height: 72, fit: 'cover', withoutEnlargement: true })
        .webp({ quality: 60 })
        .toBuffer(),
    );
    return `data:image/webp;base64,${thumb.toString('base64')}`;
  } catch (error) {
    log().warn({ err: error }, 'thumbnail failed');
    return null;
  }
}

async function analyzeOneImage(imageUrl: string): Promise<AnalyzedImage> {
  const fileName = fileNameFromUrl(imageUrl);
  const base: AnalyzedImage = {
    url: imageUrl,
    fileName,
    originalBytes: 0,
    optimizedBytes: 0,
    savedBytes: 0,
    savedPercent: 0,
    estimates: emptyEstimates(),
    width: 0,
    height: 0,
    contentType: '',
    thumbnailDataUrl: null,
    error: null,
  };

  try {
    const target = await normalizePageUrl(imageUrl);
    const fetched = await fetchWithLimits(target, {
      timeoutMs: IMAGE_TIMEOUT_MS,
      maxBytes: MAX_IMAGE_BYTES,
      accept: 'image/*,*/*;q=0.8',
    });

    const contentType = guessMime(imageUrl, fetched.contentType);
    base.contentType = contentType;
    base.originalBytes = fetched.buffer.length;

    if (contentType === 'image/svg+xml' || imageUrl.toLowerCase().includes('.svg')) {
      base.error = 'SVG не оценивается';
      return base;
    }

    if (!contentType.startsWith('image/')) {
      base.error = 'Не изображение';
      return base;
    }

    const variants = await optimizeAllFormats(fetched.buffer, fetched.buffer.length, {
      trim: false,
      quality: ESTIMATE_QUALITY,
    });

    const byFormat = Object.fromEntries(
      variants.map((variant) => [variant.format, variant]),
    ) as Partial<Record<OutputFormat, (typeof variants)[number]>>;

    const estimates: FormatEstimates = {
      optimized: estimateFromSizes(
        fetched.buffer.length,
        byFormat.optimized?.optimizedSize ?? fetched.buffer.length,
      ),
      webp: estimateFromSizes(
        fetched.buffer.length,
        byFormat.webp?.optimizedSize ?? fetched.buffer.length,
      ),
      avif: estimateFromSizes(
        fetched.buffer.length,
        byFormat.avif?.optimizedSize ?? fetched.buffer.length,
      ),
    };

    const primary = estimates.webp;
    const meta = byFormat.webp ?? byFormat.optimized ?? variants[0];

    base.estimates = estimates;
    base.optimizedBytes = primary.optimizedBytes;
    base.savedBytes = primary.savedBytes;
    base.savedPercent = primary.savedPercent;
    base.width = meta?.originalWidth || meta?.width || 0;
    base.height = meta?.originalHeight || meta?.height || 0;
    base.thumbnailDataUrl = await makeThumbnail(fetched.buffer);
    return base;
  } catch (error) {
    log().warn({ err: error, url: publicUrl(imageUrl) }, 'image analysis failed');
    base.error = error instanceof Error ? error.message : 'Не удалось загрузить';
    return base;
  }
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => run());
  await Promise.all(runners);
  return results;
}

export async function analyzePage(rawUrl: string): Promise<AnalyzePageResult> {
  const pageUrl = await normalizePageUrl(rawUrl);
  const page = await fetchWithLimits(pageUrl, {
    timeoutMs: PAGE_TIMEOUT_MS,
    maxBytes: MAX_PAGE_BYTES,
    accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
  });

  const htmlType = page.contentType.toLowerCase();
  if (htmlType && !htmlType.includes('html') && !htmlType.includes('xml') && !htmlType.includes('text/')) {
    throw new UpstreamError('По ссылке не HTML-страница.', 422);
  }

  const html = page.buffer.toString('utf8');
  const found = extractImageUrls(html, page.finalUrl);
  const truncated = found.length > MAX_IMAGES;
  const selected = found.slice(0, MAX_IMAGES);

  const images = await mapPool(selected, FETCH_CONCURRENCY, (url) => analyzeOneImage(url));
  const successful = images.filter((item) => !item.error && item.originalBytes > 0);

  const totalBytes = successful.reduce((sum, item) => sum + item.originalBytes, 0);
  const estimates: FormatEstimates = {
    optimized: sumEstimates(successful, 'optimized', totalBytes),
    webp: sumEstimates(successful, 'webp', totalBytes),
    avif: sumEstimates(successful, 'avif', totalBytes),
  };
  const bestFormat = pickBestFormat(estimates);
  const primary = estimates.webp;

  images.sort((a, b) => b.savedBytes - a.savedBytes || b.originalBytes - a.originalBytes);

  return {
    url: pageUrl.toString(),
    finalUrl: page.finalUrl,
    imageCount: found.length,
    analyzedCount: successful.length,
    skippedCount: images.length - successful.length,
    truncated,
    totalBytes,
    optimizedBytes: primary.optimizedBytes,
    savedBytes: primary.savedBytes,
    savedPercent: primary.savedPercent,
    estimates,
    bestFormat,
    images,
  };
}

function uniqueZipName(base: string, extension: string, used: Set<string>): string {
  let name = `${base}.${extension}`;
  if (!used.has(name)) {
    used.add(name);
    return name;
  }

  let index = 2;
  while (used.has(`${base}-${index}.${extension}`)) {
    index += 1;
  }
  name = `${base}-${index}.${extension}`;
  used.add(name);
  return name;
}

function sanitizeZipBaseName(fileName: string): string {
  const raw = fileName.replace(/\.[^.]+$/, '') || 'image';
  const cleaned = raw
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return cleaned || 'image';
}

export type OptimizedZipResult = {
  zip: Buffer;
  included: number;
  failed: number;
  skippedBudget: number;
  requested: number;
};

type ZipItemOk = {
  ok: true;
  fileName: string;
  buffer: Buffer;
  originalBytes: number;
  optimizedBytes: number;
};

type ZipItemFail = {
  ok: false;
  url: string;
  error: string;
};

async function optimizeRemoteForZip(imageUrl: string): Promise<ZipItemOk | ZipItemFail> {
  try {
    const target = await normalizePageUrl(imageUrl);
    const fetched = await fetchWithLimits(target, {
      timeoutMs: IMAGE_TIMEOUT_MS,
      maxBytes: MAX_IMAGE_BYTES,
      accept: 'image/*,*/*;q=0.8',
    });

    const contentType = guessMime(imageUrl, fetched.contentType);
    if (contentType === 'image/svg+xml' || imageUrl.toLowerCase().includes('.svg')) {
      return { ok: false, url: imageUrl, error: 'SVG пропускаем' };
    }
    if (!contentType.startsWith('image/')) {
      return { ok: false, url: imageUrl, error: 'Не изображение' };
    }

    const optimized = await optimizeImage(fetched.buffer, fetched.buffer.length, {
      format: 'webp',
      trim: false,
      quality: ESTIMATE_QUALITY,
    });

    return {
      ok: true,
      fileName: fileNameFromUrl(imageUrl),
      buffer: optimized.buffer,
      originalBytes: fetched.buffer.length,
      optimizedBytes: optimized.optimizedSize,
    };
  } catch (error) {
    log().warn({ err: error, url: publicUrl(imageUrl) }, 'zip image failed');
    return {
      ok: false,
      url: imageUrl,
      error: error instanceof Error ? error.message : 'Ошибка загрузки',
    };
  }
}

/**
 * Download + WebP-optimize selected image URLs and pack into a ZIP.
 * Caps: 20 files, ~40 MB of source bytes, SSRF checks on every URL.
 */
export async function buildOptimizedZipFromUrls(
  rawUrls: string[],
): Promise<OptimizedZipResult> {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of rawUrls) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    unique.push(trimmed);
    if (unique.length >= MAX_ZIP_IMAGES) break;
  }

  if (unique.length === 0) {
    throw new UpstreamError('Нет изображений для скачивания.', 422);
  }

  const results = await mapPool(unique, ZIP_CONCURRENCY, (url) => optimizeRemoteForZip(url));

  const zip = new JSZip();
  const folder = zip.folder('optimized');
  if (!folder) {
    throw new UpstreamError('Не удалось создать архив.');
  }

  const usedNames = new Set<string>();
  const reportLines: string[] = [
    'Fitpix — отчёт оптимизации',
    `Файлов в запросе: ${unique.length}`,
    `Лимит файлов: ${MAX_ZIP_IMAGES}`,
    `Лимит исходников: ${Math.round(MAX_ZIP_SOURCE_BYTES / (1024 * 1024))} МБ`,
    '',
  ];

  let included = 0;
  let failed = 0;
  let skippedBudget = 0;
  let sourceBudget = 0;

  for (let i = 0; i < results.length; i += 1) {
    const item = results[i];
    const sourceUrl = unique[i];

    if (!item.ok) {
      failed += 1;
      reportLines.push(`FAIL  ${sourceUrl} — ${item.error}`);
      continue;
    }

    if (sourceBudget + item.originalBytes > MAX_ZIP_SOURCE_BYTES) {
      skippedBudget += 1;
      reportLines.push(
        `SKIP  ${sourceUrl} — превышен лимит ${Math.round(MAX_ZIP_SOURCE_BYTES / (1024 * 1024))} МБ исходников`,
      );
      continue;
    }

    sourceBudget += item.originalBytes;
    const base = sanitizeZipBaseName(item.fileName);
    const name = uniqueZipName(base, 'webp', usedNames);
    folder.file(name, item.buffer);
    included += 1;
    reportLines.push(
      `OK    ${name} — ${item.originalBytes} → ${item.optimizedBytes} bytes (${sourceUrl})`,
    );
  }

  if (included === 0) {
    throw new UpstreamError(
      failed > 0
        ? 'Не удалось оптимизировать ни одного изображения.'
        : 'Все изображения отфильтрованы лимитом веса.',
      422,
    );
  }

  reportLines.splice(
    4,
    0,
    `В архиве: ${included}`,
    `Ошибок: ${failed}`,
    `Пропущено по лимиту веса: ${skippedBudget}`,
    '',
  );
  zip.file('report.txt', reportLines.join('\n'));

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return {
    zip: zipBuffer,
    included,
    failed,
    skippedBudget,
    requested: unique.length,
  };
}
