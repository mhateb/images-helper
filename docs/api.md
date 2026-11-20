# API

[← к кейсу](../README.md)

Базовый URL в разработке — `http://localhost:3001`. Vite проксирует `/api` с `http://localhost:5173`.

`GET /api/health` → `{ "ok": true, "version": "1.0.0", "uptime": 3600 }`.

`version` — поле `version` из `server/package.json`. `uptime` — целые секунды с запуска процесса. Ответ без кэша на стороне приложения: монитор видит текущий процесс.

## Оптимизация

`POST /api/optimize` — multipart, поле файла `image`.

| Поле | Описание |
|------|----------|
| `format` | `optimized`, `webp` или `avif` |
| `trim` | `true` / `false`, автообрезка однотонных краёв |
| `quality` | 1–100 |
| `resize` | `true` / `false` |
| `resizeMaxWidth` | Максимальная ширина, если `resize=true`. Увеличение отключено |
| `cropX`, `cropY`, `cropWidth`, `cropHeight` | Область в пикселях исходника |

Ответ — файл и заголовки `X-Original-Size`, `X-Optimized-Size`, `X-Width`, `X-Height`, `X-Original-Width`, `X-Original-Height`, `X-Extension`.

Лимит файла — 30 МБ. Типы: JPEG, PNG, WebP, AVIF, GIF. С одного IP — 180 запросов за 10 минут, иначе `429` и `Retry-After`.

`POST /api/optimize-all` — те же поля без одного `format`. В ответе ZIP со всеми вариантами.

`POST /api/optimize-responsive` — слоты art direction (md / lg / xl). В ZIP лежат файлы 1x/2x и `picture.html`. Заголовки: `X-Tokens`, `X-Has-2x`, `X-Fallback-Extension`, `X-Img-Width`, `X-Img-Height`.

## Анализ страницы

`POST /api/analyze-page` — JSON `{ "url": "https://example.com" }`.

В ответе список картинок из HTML, оценка веса для исходного формата, WebP и AVIF (quality 80) и суммарная экономия. Лимиты: HTML до 2 МБ, картинка до 8 МБ, не больше 40 URL в оценке. С одного IP — 8 анализов за 10 минут, иначе `429` и `Retry-After`.

`POST /api/analyze-fetch-image` — JSON `{ "url": "https://…" }`. Отдаёт одну публичную картинку, чтобы открыть её в редакторе. Те же ограничения на адрес, что у анализа.

`POST /api/analyze-download-zip` — JSON `{ "urls": ["https://…"], "pageUrl": "https://…" }`. ZIP в WebP. Не больше 20 URL и 40 МБ исходников, не больше 3 запросов за 10 минут и 2 сборки одновременно.

## Багрепорт

`POST /api/bug-report` — multipart: `description`, опционально `contactEmail`, `pageUrl`, `userAgent`, файл `screenshot` (JPEG, PNG, WebP, GIF, до 5 МБ). С одного IP — 5 сообщений за 10 минут, иначе `429` и `Retry-After`.

Если SMTP не настроен, ответ `503`. Переменные — в [деплое](deploy.md).
