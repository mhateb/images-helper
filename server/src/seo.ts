import {
  SITE_NAME,
  SPA_PATHS,
  absoluteUrl,
  getSeoRoute,
  jsonLdForPath,
  normalizePath,
  normalizeSiteUrl,
  ogImageUrl,
} from 'shared';

export const SITE_URL = normalizeSiteUrl(process.env.PUBLIC_SITE_URL);
export const DEFAULT_OG_IMAGE = ogImageUrl(SITE_URL);

export { SPA_PATHS, normalizePath };

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

/** Yandex Metrika counter from runtime env. */
export function resolveYmCounterId(): number {
  const raw = process.env.VITE_YM_ID || process.env.YM_ID || '';
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? Math.trunc(id) : 0;
}

function injectYmRuntimeConfig(html: string): string {
  const id = resolveYmCounterId();
  const script =
    id > 0
      ? `<script id="fitpix-ym-config">window.__FITPIX_YM_ID__=${id};</script>`
      : '';

  if (/id="fitpix-ym-config"/.test(html)) {
    return html.replace(
      /<script[^>]*id="fitpix-ym-config"[^>]*>[\s\S]*?<\/script>/i,
      script,
    );
  }

  if (!script) return html;
  // Classic inline script before </head> runs before deferred module scripts.
  return html.replace('</head>', `    ${script}\n  </head>`);
}

/** Подписывает inline- и модульные скрипты документа nonce из CSP. */
export function applyScriptNonce(html: string, nonce: string): string {
  if (!/^[a-f0-9]{32}$/.test(nonce)) return html;
  return html.replace(/<script\b([^>]*)>/gi, (_match, attrs: string) => {
    if (/(?:^|\s)nonce\s*=/i.test(attrs)) return _match;
    return `<script nonce="${nonce}"${attrs}>`;
  });
}

export function applySeoToHtml(html: string, pathname: string, scriptNonce = ''): string {
  const route = getSeoRoute(pathname);
  const url = absoluteUrl(SITE_URL, route.path);
  const jsonLd = JSON.stringify(jsonLdForPath(SITE_URL, pathname));

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

  next = injectYmRuntimeConfig(next);
  next = applyScriptNonce(next, scriptNonce);

  const shell = [
    '<div data-seo-shell>',
    `  <h1>${escapeHtml(route.shellHeading)}</h1>`,
    `  <p>${escapeHtml(route.shellLead)}</p>`,
    '  <nav aria-label="Разделы">',
    '    <a href="/">Инструмент</a>',
    '    <a href="/guide">Гайд</a>',
    '    <a href="/analyze">Анализ</a>',
    '    <a href="/privacy">Конфиденциальность</a>',
    '  </nav>',
    '</div>',
  ].join('');

  next = replaceRootInner(next, shell);

  return next;
}

/** Replace #root inner HTML, matching nested closing </div> tags. */
function replaceRootInner(html: string, inner: string): string {
  const open = '<div id="root">';
  const start = html.indexOf(open);
  if (start === -1) return html;

  const innerStart = start + open.length;
  let depth = 1;
  let i = innerStart;

  while (i < html.length && depth > 0) {
    const nextOpen = html.indexOf('<div', i);
    const nextClose = html.indexOf('</div>', i);
    if (nextClose === -1) break;

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + 4;
      continue;
    }

    depth -= 1;
    if (depth === 0) {
      return `${html.slice(0, innerStart)}${inner}${html.slice(nextClose)}`;
    }
    i = nextClose + 6;
  }

  return html;
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
