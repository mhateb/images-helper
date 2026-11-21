import { BP } from 'shared';
import { callout, code, list, params, section, steps, text } from './blocks';
import type { GuideSection } from './types';

export const sourceSections: GuideSection[] = [
  section('Как работает <source>', [
    text(
      'Браузер проверяет `<source>` сверху вниз и берёт первый подходящий. Остальные не загружаются.',
    ),
    code(`<picture>
  <source srcset="hero.avif" type="image/avif" />
  <source srcset="hero.webp" type="image/webp" />
  <img src="hero.jpg" alt="Hero" width="${BP.xl}" height="720" />
</picture>`),
  ]),
  section('Как браузер выбирает файл', [
    steps([
      'Если у `source` есть `media` и запрос не совпал — пропускает.',
      'Если у `source` есть `type` и браузер не поддерживает формат — пропускает.',
      'Из подошедшего `source` берёт файл по `srcset` и `sizes`.',
      'Если подходящего `source` нет — берёт `<img src>`.',
    ]),
    callout(
      'Порядок: сначала узкие `media`, внутри каждого — AVIF, затем WebP. Общие `source` без `media` — в конце.',
    ),
  ]),
  section('Атрибуты', [
    params([
      {
        term: 'type',
        detail: 'MIME-тип: `image/avif` или `image/webp`. Если браузер формат не знает, `source` игнорируется.',
      },
      {
        term: 'srcset',
        detail: `Один URL или список файлов с шириной: \`${BP.md}w\`, \`${BP.lg}w\`, \`${BP.xl}w\`. Подробности — вкладка **srcset**.`,
      },
      {
        term: 'sizes',
        detail: `Ширина слота в CSS-пикселях, например \`(max-width: ${BP.md - 1}px) 100vw, (max-width: ${BP.lg - 1}px) 50vw, 400px\`. Без \`sizes\` браузер считает, что картинка занимает всю ширину окна.`,
      },
      {
        term: 'media',
        detail: 'Условие, при котором `source` работает. Подробности — вкладка **media**.',
      },
    ]),
  ]),
  section('Зачем нужен img внутри picture', [
    list([
      'Это fallback для браузеров без поддержки `<picture>` и форматов.',
      'Атрибуты `alt`, `width`, `height`, `loading` задаются только здесь.',
      'В `src` — самый совместимый файл, обычно JPEG или PNG.',
    ]),
  ]),
];
