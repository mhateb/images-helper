import { useEffect } from 'react';
import { SPA_PATHS, normalizePath } from 'shared';
import {
  DEFAULT_OG_IMAGE,
  SITE_LOCALE,
  SITE_NAME,
  absoluteUrl,
  getSeoRoute,
  jsonLdForPath,
} from '../seo/site';

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function upsertJsonLd(data: Record<string, unknown>) {
  const id = 'fitpix-jsonld';
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement('script');
    el.id = id;
    el.type = 'application/ld+json';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export function useDocumentSeo(path: string) {
  useEffect(() => {
    const route = getSeoRoute(path);
    const url = absoluteUrl(route.path);

    document.title = route.title;
    upsertMeta('name', 'description', route.description);
    upsertMeta('name', 'application-name', SITE_NAME);
    upsertMeta('property', 'og:site_name', SITE_NAME);
    upsertMeta('property', 'og:locale', SITE_LOCALE);
    upsertMeta('property', 'og:type', route.ogType);
    upsertMeta('property', 'og:title', route.title);
    upsertMeta('property', 'og:description', route.description);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:image', DEFAULT_OG_IMAGE);
    upsertMeta('property', 'og:image:width', '1200');
    upsertMeta('property', 'og:image:height', '630');
    upsertMeta('property', 'og:image:alt', SITE_NAME);
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', route.title);
    upsertMeta('name', 'twitter:description', route.description);
    upsertMeta('name', 'twitter:image', DEFAULT_OG_IMAGE);
    upsertLink('canonical', url);
    upsertJsonLd(jsonLdForPath(path));

    const robots = SPA_PATHS.has(normalizePath(path)) ? 'index,follow' : 'noindex,nofollow';
    upsertMeta('name', 'robots', robots);
  }, [path]);
}
