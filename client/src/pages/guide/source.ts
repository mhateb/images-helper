import { BP } from 'shared';
import { callout, code, list, params, section, steps, text } from './blocks';
import type { GuideSection } from './types';

export const sourceSections: GuideSection[] = [
  section('Как работает <source>', [
    text(
      'Внутри `<picture>` браузер сверху вниз смотрит каждый `<source>`. Первый, чьи условия выполнены, становится источником для `<img>`. Остальные не качаются.',
    ),
    code(`<picture>
  <source srcset="hero.avif" type="image/avif" />
  <source srcset="hero.webp" type="image/webp" />
  <img src="hero.jpg" alt="Hero" width="${BP.xl}" height="720" />
</picture>`),
  ]),
  section('Порядок проверки', [
    steps([
      'Есть ли `media`? Если да и медиазапрос *не* совпал — source пропускается.',
      'Есть ли `type`? Если формат браузер не умеет — source пропускается.',
      'Из подходящего source берётся URL через `srcset` / `sizes`.',
      'Если ни один source не подошёл — `<img src>` (и его srcset, если есть).',
    ]),
    callout(
      'Сначала узкие media (mobile → md → lg → xl) и современные type (AVIF → WebP), внизу — общие. Первый совпавший побеждает.',
    ),
  ]),
  section('Атрибуты source', [
    params([
      {
        term: 'type',
        detail:
          'MIME: `image/avif`, `image/webp`. Без поддержки формата source игнорируется.',
      },
      {
        term: 'srcset',
        detail: `Один URL или кандидаты с w-дескрипторами (\`${BP.md}w\`, \`${BP.lg}w\`, \`${BP.xl}w\`…). Подробнее — вкладка **srcset**.`,
      },
      {
        term: 'sizes',
        detail: `CSS-ширина слота по брейкпоинтам проекта, например \`(max-width: ${BP.md - 1}px) 100vw, (max-width: ${BP.lg - 1}px) 50vw, 400px\`. Без sizes при w-дескрипторах браузер часто считает слот = весь viewport.`,
      },
      {
        term: 'media',
        detail:
          'Запросы на md / lg / xl из токенов проекта. Арт-директинг — вкладка **media**.',
      },
    ]),
  ]),
  section('Зачем нужен img внутри picture', [
    list([
      'Обязательный fallback и «настоящий» элемент (alt, размеры, lazy, decoding).',
      '`source` только подменяет ресурс для img.',
      'В `src` — самый совместимый файл (обычно JPEG/PNG из «Optimized»).',
    ]),
  ]),
];
