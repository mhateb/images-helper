import { randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import helmet from '@fastify/helmet';
import type { FastifyInstance, FastifyRequest } from 'fastify';

const CSP_NONCE = Symbol('cspNonce');

type NonceRequest = IncomingMessage & { [CSP_NONCE]?: string };

/**
 * Зеркала счётчика из документации Метрики.
 * Примеры CSP там неполные: региональный хост и Вебвизор должны быть разрешены явно.
 */
const YM_MC_HTTPS = [
  'https://mc.yandex.ru',
  'https://mc.yandex.az',
  'https://mc.yandex.by',
  'https://mc.yandex.co.il',
  'https://mc.yandex.com',
  'https://mc.yandex.com.am',
  'https://mc.yandex.com.ge',
  'https://mc.yandex.com.tr',
  'https://mc.yandex.ee',
  'https://mc.yandex.fr',
  'https://mc.yandex.kg',
  'https://mc.yandex.kz',
  'https://mc.yandex.lt',
  'https://mc.yandex.lv',
  'https://mc.yandex.md',
  'https://mc.yandex.tj',
  'https://mc.yandex.tm',
  'https://mc.yandex.uz',
  'https://mc.webvisor.com',
  'https://mc.webvisor.org',
];

const YM_HTTPS = [...YM_MC_HTTPS, 'https://yastatic.net'];

const YM_WSS = YM_MC_HTTPS.map((origin) => origin.replace('https://', 'wss://'));

/** Интерфейс Метрики открывает сайт во фрейме для Вебвизора и карт. */
const YM_FRAME_ANCESTORS = [
  'https://metrika.yandex.ru',
  'https://metrika.yandex.by',
  'https://metrika.yandex.com',
  'https://metrika.yandex.com.tr',
  'https://metrika.yandex.kz',
  'https://metrika.yandex.uz',
  'https://metrika.yandex',
  'https://metrika.ya.ru',
  'https://metrica.yandex.ru',
  'https://metrica.yandex.by',
  'https://metrica.yandex.com',
  'https://metrica.yandex.com.tr',
  'https://metrica.yandex.kz',
  'https://metrica.yandex',
  'https://metrica.ya.ru',
  'https://analytics.yandex.ru',
  'https://analytics.yandex.by',
  'https://analytics.yandex.com',
  'https://analytics.yandex.com.tr',
  'https://analytics.yandex.kz',
  'https://metr.yandex.ru',
  'https://metr.yandex.by',
  'https://metr.yandex.com',
  'https://metr.yandex.com.tr',
  'https://metr.yandex.kz',
];

function scriptNonceDirective(req: IncomingMessage, _res: ServerResponse): string {
  const carrier = req as NonceRequest;
  const nonce = carrier[CSP_NONCE] ?? randomBytes(16).toString('hex');
  carrier[CSP_NONCE] = nonce;
  return `'nonce-${nonce}'`;
}

export function cspNonceFrom(request: FastifyRequest): string {
  return (request.raw as NonceRequest)[CSP_NONCE] ?? '';
}

export async function registerSecurity(app: FastifyInstance): Promise<void> {
  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        // Локальный HTTP не должен превращать ассеты в https://localhost.
        upgradeInsecureRequests: null,
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'", ...YM_HTTPS, scriptNonceDirective],
        // React не использует onClick в разметке. Nonce на script-src не покрывает атрибуты.
        scriptSrcAttr: ["'none'"],
        // Критический CSS, страница 404 и style-атрибуты react-image-crop.
        // Nonce на style-src не ставим: он отменяет 'unsafe-inline'.
        styleSrc: ["'self'", "'unsafe-inline'", 'https://yastatic.net'],
        styleSrcAttr: ["'unsafe-inline'"],
        fontSrc: ["'self'", 'https://yastatic.net', 'data:'],
        imgSrc: ["'self'", 'blob:', 'data:', ...YM_HTTPS],
        connectSrc: [
          "'self'",
          ...YM_HTTPS,
          ...YM_WSS,
        ],
        // Вебвизор, карта кликов и превью через URL.createObjectURL.
        frameSrc: ['blob:', ...YM_HTTPS],
        workerSrc: ["'self'", 'blob:', ...YM_MC_HTTPS],
        childSrc: ['blob:', ...YM_HTTPS],
        frameAncestors: ["'self'", ...YM_FRAME_ANCESTORS],
        formAction: ["'self'"],
      },
    },
    // require-corp оборвал бы tag.js: у него нет CORP.
    crossOriginEmbedderPolicy: false,
    // same-origin спрятал бы og:image от мессенджеров и превью ссылок.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // no-referrer лишил бы Метрику источника перехода.
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });
}
