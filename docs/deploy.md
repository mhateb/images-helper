# Деплой

[← к кейсу](../README.md)

Приложение stateless: базы нет, картинка живёт в памяти запроса. Хватает одного Docker-контейнера и около 1 ГБ RAM. Sharp держит файл в памяти, для исходников до 30 МБ лучше не опускаться ниже этого объёма.

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

Без `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` или без `BUG_REPORT_TO` `POST /api/bug-report` отвечает `503`.

Пароль приложения Яндекса: [id.yandex.ru/security/app-passwords](https://id.yandex.ru/security/app-passwords), тип «Почта».

## Docker

Один контейнер: API и собранный UI на порту `3001`.

```bash
docker compose up --build -d
```

Открыть http://localhost:3001. Проверка: http://localhost:3001/api/health.

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

Образ многостадийный: зависимости, сборка клиента и сервера, затем `node:22-bookworm-slim` под пользователем `app`. Каталог статики — `/app/client/dist`.

## Что выбрать

| Вариант | Когда брать | Оценка |
|---------|-------------|--------|
| **Timeweb Cloud → Apps / Docker** | Поднять за 10–15 минут, есть UI и домен | Баланс скорости и простоты |
| **Amvera** | Деплой из Git или Dockerfile, без своей админки VPS | Самый простой PaaS. В репозитории есть `amvera.yml`, порт контейнера `3001` |
| **VPS (Timeweb / Beget / VDSina)** и `docker compose` | Нужен контроль и дешевле надолго | Универсальный вариант |
| **Selectel / Yandex Cloud** | Уже есть аккаунт и нужна масштабируемость | Избыточно для старта |

Для быстрого старта — Timeweb Cloud Apps или Amvera. Если удобен SSH — любой дешёвый VPS и `docker compose up -d`.

На Amvera номер Метрики задаётся на этапе **Запуск**: сервер подставляет `VITE_YM_ID` в HTML уже при отдаче страницы. На сборке эта переменная процессу Vite может быть недоступна, и это нормально.

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
