export const DEFAULT_SITE_URL = 'https://fitpix.ru';
export const SITE_NAME = 'Fitpix.ru';
export const SITE_LOCALE = 'ru_RU';

export type SeoRoute = {
  path: string;
  title: string;
  description: string;
  ogType: 'website' | 'article';
  shellHeading: string;
  shellLead: string;
};

export const SEO_ROUTES: Record<string, SeoRoute> = {
  '/': {
    path: '/',
    title: 'Fitpix.ru — онлайн-оптимизация картинок: WebP, AVIF, обрезка и сжатие',
    description:
      'Сжатие JPEG и PNG, конвертация в WebP и AVIF, обрезка. До 20 файлов за раз, бесплатно и без регистрации.',
    ogType: 'website',
    shellHeading: 'Онлайн-оптимизация картинок для веба',
    shellLead:
      'Сжимайте JPEG и PNG, конвертируйте в WebP и AVIF, обрезайте картинки. Бесплатно и без регистрации.',
  },
  '/guide': {
    path: '/guide',
    title: 'Гайд по оптимизации картинок и тегу picture — Fitpix.ru',
    description:
      'Как готовить картинки под <picture>: форматы WebP и AVIF, брейкпоинты, source, media и srcset.',
    ogType: 'article',
    shellHeading: 'Гайд по оптимизации картинок для веба',
    shellLead:
      'Форматы, брейкпоинты и тег picture: как подготовить картинки под слоты в вёрстке.',
  },
  '/analyze': {
    path: '/analyze',
    title: 'Анализ изображений сайта — Fitpix.ru',
    description:
      'Вставьте URL страницы: Fitpix найдёт картинки, посчитает их вес и покажет, сколько можно сэкономить в WebP и AVIF.',
    ogType: 'website',
    shellHeading: 'Анализ изображений сайта',
    shellLead:
      'Сколько картинок на странице, сколько они весят и сколько можно сэкономить.',
  },
  '/privacy': {
    path: '/privacy',
    title: 'Политика конфиденциальности — Fitpix.ru',
    description:
      'Как Fitpix.ru обрабатывает изображения, cookies Яндекс.Метрики и сообщения о проблемах.',
    ogType: 'website',
    shellHeading: 'Политика конфиденциальности',
    shellLead:
      'Как Fitpix обрабатывает изображения, cookies аналитики и сообщения о проблемах.',
  },
};

export const SPA_PATHS = new Set(Object.keys(SEO_ROUTES));

export function normalizeSiteUrl(value: string | undefined | null): string {
  const raw = (value ?? '').trim();
  return (raw || DEFAULT_SITE_URL).replace(/\/+$/, '');
}

export function ogImageUrl(siteUrl: string): string {
  return `${normalizeSiteUrl(siteUrl)}/og-image.jpg`;
}

export function normalizePath(pathname: string): string {
  const bare = pathname.split('?')[0]?.split('#')[0] ?? '/';
  return bare.replace(/\/+$/, '') || '/';
}

export function getSeoRoute(pathname: string): SeoRoute {
  const normalized = normalizePath(pathname);
  return SEO_ROUTES[normalized] ?? SEO_ROUTES['/'];
}

export function absoluteUrl(siteUrl: string, path: string): string {
  const origin = normalizeSiteUrl(siteUrl);
  if (path === '/') return `${origin}/`;
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${suffix}`;
}

export function jsonLdForPath(siteUrl: string, pathname: string): Record<string, unknown> {
  const origin = normalizeSiteUrl(siteUrl);
  const route = getSeoRoute(pathname);

  if (route.path === '/guide') {
    return {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: route.shellHeading,
      name: route.title,
      description: route.description,
      inLanguage: 'ru',
      isPartOf: {
        '@type': 'WebSite',
        name: SITE_NAME,
        url: origin,
      },
      mainEntityOfPage: absoluteUrl(origin, '/guide'),
    };
  }

  if (route.path === '/privacy') {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: route.title,
      description: route.description,
      inLanguage: 'ru',
      isPartOf: {
        '@type': 'WebSite',
        name: SITE_NAME,
        url: origin,
      },
      mainEntityOfPage: absoluteUrl(origin, '/privacy'),
    };
  }

  if (route.path === '/analyze') {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: route.shellHeading,
      url: absoluteUrl(origin, '/analyze'),
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Any',
      inLanguage: 'ru',
      description: route.description,
      isPartOf: {
        '@type': 'WebSite',
        name: SITE_NAME,
        url: origin,
      },
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'RUB',
      },
    };
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE_NAME,
    url: origin,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Any',
    inLanguage: 'ru',
    description: route.description,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'RUB',
    },
  };
}
