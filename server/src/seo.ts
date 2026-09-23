export const SITE_URL = (process.env.PUBLIC_SITE_URL ?? 'https://fitpix.ru').replace(
  /\/+$/,
  '',
);
export const SITE_NAME = 'Fitpix.ru';
export const SITE_LOCALE = 'ru_RU';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.jpg`;

type SeoRoute = {
  path: string;
  title: string;
  description: string;
  ogType: 'website' | 'article';
  shellHeading: string;
  shellLead: string;
};

const SEO_ROUTES: Record<string, SeoRoute> = {
  '/': {
    path: '/',
    title: 'Fitpix.ru — онлайн-оптимизация картинок: WebP, AVIF, кроп и сжатие',
    description:
      'Бесплатный инструмент для оптимизации изображений: сжатие JPEG/PNG, конвертация в WebP и AVIF, авто-trim и ручной кроп. До 20 файлов за раз, без регистрации.',
    ogType: 'website',
    shellHeading: 'Онлайн-оптимизация картинок для веба',
    shellLead:
      'Сжимайте JPEG и PNG, конвертируйте в WebP и AVIF, обрезайте и убирайте лишние поля — бесплатно и без регистрации.',
  },
  '/guide': {
    path: '/guide',
    title: 'Гайд по оптимизации картинок и тегу picture — Fitpix.ru',
    description:
      'Практический гайд: форматы WebP/AVIF, брейкпоинты, source/media/srcset и подготовка ассетов под <picture> для быстрой вёрстки.',
    ogType: 'article',
    shellHeading: 'Гайд по оптимизации картинок для веба',
    shellLead:
      'Форматы, брейкпоинты и тег picture: как готовить ассеты под реальные слоты в вёрстке.',
  },
};

export const SPA_PATHS = new Set(Object.keys(SEO_ROUTES));

export function normalizePath(pathname: string): string {
  const bare = pathname.split('?')[0]?.split('#')[0] ?? '/';
  return bare.replace(/\/+$/, '') || '/';
}

function absoluteUrl(path: string): string {
  return path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`;
}

function jsonLdFor(route: SeoRoute): Record<string, unknown> {
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
        url: SITE_URL,
      },
      mainEntityOfPage: absoluteUrl('/guide'),
    };
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE_NAME,
    url: SITE_URL,
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

function replaceMetaContent(html: string, attr: 'name' | 'property', key: string, content: string) {
  const re = new RegExp(
    `(<meta\\s+${attr}="${key}"\\s+content=")([^"]*)(")`,
    'i',
  );
  if (re.test(html)) {
    return html.replace(re, `$1${escapeAttr(content)}$3`);
  }
  return html.replace(
    '</head>',
    `    <meta ${attr}="${key}" content="${escapeAttr(content)}" />\n  </head>`,
  );
}

function replaceLinkHref(html: string, rel: string, href: string) {
  const re = new RegExp(`(<link\\s+rel="${rel}"\\s+href=")([^"]*)(")`, 'i');
  if (re.test(html)) {
    return html.replace(re, `$1${escapeAttr(href)}$3`);
  }
  return html.replace(
    '</head>',
    `    <link rel="${rel}" href="${escapeAttr(href)}" />\n  </head>`,
  );
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function applySeoToHtml(html: string, pathname: string): string {
  const path = normalizePath(pathname);
  const route = SEO_ROUTES[path] ?? SEO_ROUTES['/'];
  const url = absoluteUrl(route.path);
  const jsonLd = JSON.stringify(jsonLdFor(route));

  let next = html;
  next = next.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(route.title)}</title>`);
  next = replaceMetaContent(next, 'name', 'description', route.description);
  next = replaceMetaContent(next, 'name', 'robots', 'index,follow');
  next = replaceMetaContent(next, 'property', 'og:type', route.ogType);
  next = replaceMetaContent(next, 'property', 'og:title', route.title);
  next = replaceMetaContent(next, 'property', 'og:description', route.description);
  next = replaceMetaContent(next, 'property', 'og:url', url);
  next = replaceMetaContent(next, 'property', 'og:image', DEFAULT_OG_IMAGE);
  next = replaceMetaContent(next, 'name', 'twitter:title', route.title);
  next = replaceMetaContent(next, 'name', 'twitter:description', route.description);
  next = replaceMetaContent(next, 'name', 'twitter:image', DEFAULT_OG_IMAGE);
  next = replaceLinkHref(next, 'canonical', url);

  if (/id="fitpix-jsonld"/.test(next)) {
    next = next.replace(
      /<script type="application\/ld\+json" id="fitpix-jsonld">[\s\S]*?<\/script>/i,
      `<script type="application/ld+json" id="fitpix-jsonld">${jsonLd}</script>`,
    );
  } else {
    next = next.replace(
      '</head>',
      `    <script type="application/ld+json" id="fitpix-jsonld">${jsonLd}</script>\n  </head>`,
    );
  }

  const shell = [
    '<div data-seo-shell>',
    `  <h1>${escapeHtml(route.shellHeading)}</h1>`,
    `  <p>${escapeHtml(route.shellLead)}</p>`,
    '  <nav aria-label="Разделы">',
    '    <a href="/">Инструмент</a>',
    '    <a href="/guide">Гайд</a>',
    '  </nav>',
    '</div>',
  ].join('');

  next = next.replace(
    /<div id="root">[\s\S]*?<\/div>/i,
    `<div id="root">${shell}</div>`,
  );

  return next;
}

export function notFoundPageHtml(): string {
  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex,nofollow" />
    <title>Страница не найдена — ${SITE_NAME}</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: #fafafa; color: #0f172a; }
      main { text-align: center; padding: 2rem; }
      a { color: #4f46e5; }
    </style>
  </head>
  <body>
    <main>
      <h1>404</h1>
      <p>Такой страницы нет.</p>
      <p><a href="/">На главную Fitpix.ru</a> · <a href="/guide">Гайд</a></p>
    </main>
  </body>
</html>`;
}
