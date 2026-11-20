# Changelog

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/), версии — на [SemVer](https://semver.org/lang/ru/).

## [1.0.0] - 2026-11-21

Первый отмеченный релиз Fitpix.

### Добавлено

- Оптимизация JPEG, PNG, WebP, AVIF и GIF: очередь, обрезка, сравнение веса, ZIP и адаптивный `<picture>`.
- Анализ картинок на публичной странице по URL. Адрес проверяется до соединения, включая повторный DNS-ответ в момент `connect`.
- Сообщение о проблеме, подстановка SEO в HTML и Яндекс.Метрика только после согласия.
- `GET /api/health` отдаёт `ok`, версию из `server/package.json` и аптайм процесса. Снаружи тот же URL рассчитан на монитор UptimeRobot.
- Один Docker-образ, проверка здоровья контейнера и CI.

[1.0.0]: https://github.com/mhateb/images-helper/releases/tag/v1.0.0
