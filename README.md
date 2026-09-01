# Images Helper

Инструмент для оптимизации картинок: сжатие, WebP/AVIF, авто-trim и ручной кроп.

## Стек

- **client** — React + Vite + TanStack Query
- **server** — Node.js + Fastify + Sharp

## Локальная разработка

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001
- Health: http://localhost:3001/api/health

Vite проксирует `/api` на backend.

## Docker

Один контейнер: API + собранный UI на порту `3001`.

```bash
docker compose up --build -d
```

Открыть: http://localhost:3001  
Health: http://localhost:3001/api/health

Другой порт на хосте:

```bash
PORT=8080 docker compose up --build -d
```

Без Compose:

```bash
docker build -t imageshelper .
docker run --rm -p 3001:3001 imageshelper
```

Остановка:

```bash
docker compose down
```

## Быстрый деплой в РФ

Приложение stateless (без БД и секретов) — достаточно одного Docker-контейнера и 1 ГБ RAM.

### Что выбрать

| Вариант | Когда брать | Оценка |
|---------|-------------|--------|
| **Timeweb Cloud → Apps / Docker** | Нужно поднять за 10–15 минут, есть UI и домен | Лучший баланс скорости и простоты |
| **Amvera** | Деплой из Git/Dockerfile без админки VPS | Самый простой PaaS |
| **VPS (Timeweb / Beget / VDSina)** + `docker compose` | Нужен контроль и дешевле надолго | Универсальный вариант |
| **Selectel / Yandex Cloud** | Уже есть аккаунт в облаке, нужна масштабируемость | Избыточно для старта |

**Рекомендация для быстрого старта:** Timeweb Cloud Apps или Amvera.  
Если ок с SSH — любой дешёвый VPS и `docker compose up -d`.

### На VPS (универсально)

```bash
# на сервере
git clone <repo-url> imageshelper
cd imageshelper
docker compose up --build -d
```

Перед контейнером поставьте reverse-proxy (Caddy/Nginx) с HTTPS. Пример Caddyfile:

```
images.example.ru {
  reverse_proxy localhost:3001
  request_body {
    max_size 32MB
  }
}
```

Минимум ресурсов: **1 vCPU / 1 ГБ RAM**, диск от 5 ГБ. Sharp держит картинки в памяти — для файлов до 30 МБ лучше не ужимать RAM ниже 1 ГБ.

### Замечания для РФ

- Образы тяните с Docker Hub; при тормозах/блокировках настройте зеркало registry у провайдера или mirror в `/etc/docker/daemon.json`.
- Зарубежные PaaS (Railway, Render, Fly) часто неудобны с оплатой из РФ — для скорости лучше российский хостинг.
- Публичный доступ без auth: сервис обрабатывает чужие файлы в RAM. Для внутреннего использования ограничьте IP или поставьте basic-auth на proxy.

## Возможности

- Загрузка изображения до **30 МБ** (JPEG, PNG, WebP, AVIF, GIF)
- Ручной кроп на превью
- Авто-trim пустых/однотонных краёв
- Форматы результата: Optimized / WebP / AVIF
- Слайдер качества, сравнение размеров, скачивание

## API

`POST /api/optimize` — multipart поле `image`, опции:

| Поле | Описание |
|------|----------|
| `format` | `optimized` \| `webp` \| `avif` |
| `trim` | `true` / `false` |
| `quality` | 1–100 |
| `cropX`, `cropY`, `cropWidth`, `cropHeight` | область кропа в пикселях исходника |

Ответ — бинарный файл и заголовки `X-Original-Size`, `X-Optimized-Size`, `X-Width`, `X-Height`, `X-Extension`.
