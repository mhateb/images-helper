import {
  DEFAULT_SITE_URL,
  SITE_LOCALE,
  SITE_NAME,
  absoluteUrl as toAbsoluteUrl,
  getSeoRoute,
  jsonLdForPath as jsonLdFor,
  normalizeSiteUrl,
  ogImageUrl,
} from 'shared';

export { SITE_LOCALE, SITE_NAME, getSeoRoute };

export const SITE_URL = normalizeSiteUrl(import.meta.env.VITE_PUBLIC_SITE_URL || DEFAULT_SITE_URL);
export const DEFAULT_OG_IMAGE = ogImageUrl(SITE_URL);

export function absoluteUrl(path: string): string {
  return toAbsoluteUrl(SITE_URL, path);
}

export function jsonLdForPath(pathname: string): Record<string, unknown> {
  return jsonLdFor(SITE_URL, pathname);
}
