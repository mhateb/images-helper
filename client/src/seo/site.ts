export const SITE_URL = String(
  import.meta.env.VITE_PUBLIC_SITE_URL || 'https://fitpix.ru',
).replace(/\/+$/, '');
export const SITE_NAME = 'Fitpix.ru';
export const SITE_LOCALE = 'ru_RU';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.jpg`;

export type SeoRoute = {
  path: string;
  title: string;
  description: string;
  ogType: 'website' | 'article';
};

export const SEO_ROUTES: Record<string, SeoRoute> = {
  '/': {
    path: '/',
    title: 'Fitpix.ru — онлайн-оптимизация картинок: WebP, AVIF, кроп и сжатие',
    description:
      'Бесплатный инструмент для оптимизации изображений: сжатие JPEG/PNG, конвертация в WebP и AVIF, авто-trim и ручной кроп. До 20 файлов за раз, без регистрации.',
    ogType: 'website',
  },
  '/guide': {
    path: '/guide',
    title: 'Гайд по оптимизации картинок и тегу picture — Fitpix.ru',
    description:
      'Практический гайд: форматы WebP/AVIF, брейкпоинты, source/media/srcset и подготовка ассетов под <picture> для быстрой вёрстки.',
    ogType: 'article',
  },
  '/privacy': {
    path: '/privacy',
    title: 'Политика конфиденциальности — Fitpix.ru',
    description:
      'Как Fitpix.ru обрабатывает изображения, cookies Яндекс.Метрики и сообщения о проблемах.',
    ogType: 'website',
  },
};

export function getSeoRoute(pathname: string): SeoRoute {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return SEO_ROUTES[normalized] ?? SEO_ROUTES['/'];
}

export function absoluteUrl(path: string): string {
  if (path === '/') return `${SITE_URL}/`;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function buildWebAppJsonLd(): Record<string, unknown> {
  const home = SEO_ROUTES['/'];
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE_NAME,
    url: SITE_URL,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Any',
    inLanguage: 'ru',
    description: home.description,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'RUB',
    },
  };
}

export function buildGuideJsonLd(): Record<string, unknown> {
  const guide = SEO_ROUTES['/guide'];
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: 'Гайд по оптимизации картинок для веба',
    name: guide.title,
    description: guide.description,
    inLanguage: 'ru',
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
    },
    mainEntityOfPage: absoluteUrl('/guide'),
  };
}

export function buildPrivacyJsonLd(): Record<string, unknown> {
  const privacy = SEO_ROUTES['/privacy'];
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: privacy.title,
    description: privacy.description,
    inLanguage: 'ru',
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
    },
    mainEntityOfPage: absoluteUrl('/privacy'),
  };
}

export function jsonLdForPath(pathname: string): Record<string, unknown> {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (normalized === '/guide') return buildGuideJsonLd();
  if (normalized === '/privacy') return buildPrivacyJsonLd();
  return buildWebAppJsonLd();
}
