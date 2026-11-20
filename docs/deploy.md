# Деплой

[← к кейсу](../README.md)

Приложение stateless: базы нет, картинка живёт в памяти запроса. Хватает одного Docker-контейнера и около 1 ГБ RAM. Sharp держит файл в памяти, для исходников до 30 МБ лучше не опускаться ниже этого объёма. Одновременно обрабатываются два изображения, лишние ждут в очереди процесса.

## Переменные окружения

Кладётся в `.env` в корне репозитория или в окружение хостинга. Docker Compose читает тот же файл.

| Переменная | Пример | Описание |
|------------|--------|----------|
| `PUBLIC_SITE_URL` | `https://fitpix.ru` | Публичный URL для SEO на сервере. Подставляется в HTML на каждый запрос |
| `VITE_PUBLIC_SITE_URL` | `https://fitpix.ru` | Тот же URL для клиента. Попадает в сборку Vite, это build-arg |
| `VITE_YM_ID` | `12345678` | Номер счётчика Яндекс.Метрики. На сервере читается в рантайме и пишется в HTML. Как устроен consent — в [аналитике](analytics.md) |
| `SMTP_HOST` | `smtp.yandex.ru` | SMTP для кнопки «Сообщить о проблеме» |
| `SMTP_PORT` | `465` | Порт (`465` = SSL) |
| `SMTP_USER` | `you@yandex.ru` | Логин |
| `SMTP_PASS` | пароль приложения | Не обычный пароль почты |
| `SMTP_FROM` | опционально | From. По умолчанию равен `SMTP_USER` |
| `BUG_REPORT_TO` | `you@example.com` | Куда слать багрепорты |
| `LOG_LEVEL` | `info` | Уровень JSON-логов: `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`. В production по умолчанию `info`, при локальной разработке `debug` |

Без `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` или без `BUG_REPORT_TO` `POST /api/bug-report` отвечает `503`.

Логи пишутся в stdout одной JSON-строкой на событие. По `SIGTERM` и `SIGINT` сервер перестаёт принимать новые соединения, дожидается текущих запросов и завершается. Если запросы не закончились за 10 секунд, процесс выходит с кодом 1. В Compose на остановку отведено 15 секунд.

Пароль приложения Яндекса: [id.yandex.ru/security/app-passwords](https://id.yandex.ru/security/app-passwords), тип «Почта».

## Docker

Один контейнер: API и собранный UI на порту `3001`.

```bash
docker compose up --build -d
```

Открыть http://localhost:3001. Проверка: http://localhost:3001/api/health — в JSON есть `ok`, `version` и `uptime`.

Другой порт на хосте:

```bash
PORT=8080 docker compose up --build -d
```

Без Compose:

```bash
docker build -t imageshelper .
docker run --rm -p 3001:3001 imageshelper
```

Остановка: `docker compose down`.

Образ многостадийный: зависимости, сборка клиента и сервера, затем `node:22-bookworm-slim` под пользователем `app`. Каталог статики — `/app/client/dist`. В образ попадает `server/package.json`: из него health берёт `version`.

## Мониторинг

Внутри контейнера healthcheck уже есть: Dockerfile и Compose раз в 30 секунд запрашивают `http://127.0.0.1:3001/api/health` и считают процесс живым при ответе `200`.

Снаружи тот же адрес проверяет [UptimeRobot](https://uptimerobot.com/). Бесплатный план опрашивает раз в 5 минут.

1. Add New Monitor → **HTTP(s) - Keyword**.
2. URL — `https://fitpix.ru/api/health`.
3. Keyword — `"ok":true`, алерт **keyword exists**. Fastify сериализует JSON без пробелов, фрагмент в теле выглядит именно так.
4. Monitoring Interval — 5 minutes.
5. Alert Contacts — почта или Telegram.

После сохранения монитора откройте Status Pages и сделайте страницу публичной. Id монитора (`m…`) виден в его URL и в настройках бейджа UptimeRobot. Его подставляют в shields.io:

```markdown
[![Uptime](https://img.shields.io/uptimerobot/ratio/m123456789-xxxxxxxx)](https://stats.uptimerobot.com/xxxxxxxx)
```

Бейдж аптайма имеет смысл добавить в README, когда id уже есть. Сейчас в шапке стоит баннер live demo на https://fitpix.ru.

## Что выбрать

| Вариант | Когда брать | Оценка |
|---------|-------------|--------|
| **Timeweb Cloud → Apps / Docker** | Поднять за 10–15 минут, есть UI и домен | Баланс скорости и простоты |
| **VPS (Timeweb / Beget / VDSina)** и `docker compose` | Нужен контроль и дешевле надолго | Универсальный вариант |
| **Selectel / Yandex Cloud** | Уже есть аккаунт и нужна масштабируемость | Избыточно для старта |

Для быстрого старта — Timeweb Cloud Apps. Если удобен SSH — любой дешёвый VPS и `docker compose up -d`.

Номер Метрики задаётся при запуске контейнера: сервер подставляет `VITE_YM_ID` в HTML уже при отдаче страницы. На сборке эта переменная процессу Vite может быть недоступна, и это нормально.

## VPS

```bash
git clone https://github.com/mhateb/images-helper.git
cd images-helper
docker compose up --build -d
```

Перед контейнером — reverse-proxy с HTTPS. Пример Caddyfile. Лимит тела нужен, потому что загрузка картинки доходит до 30 МБ:

```
images.example.ru {
  reverse_proxy localhost:3001
  request_body {
    max_size 32MB
  }
}
```

Минимум: **1 vCPU / 1 ГБ RAM**, диск от 5 ГБ.

Публичный доступ без auth: сервис обрабатывает чужие файлы в RAM. Для внутреннего использования ограничьте IP или поставьте basic-auth на proxy.

## Замечания для РФ

- Образы тяните с Docker Hub. Если registry тормозит, настройте зеркало у провайдера или mirror в `/etc/docker/daemon.json`.
- Зарубежные PaaS часто неудобны с оплатой из РФ. Для скорости лучше российский хостинг.
