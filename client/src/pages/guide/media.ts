import { BP } from 'shared';
import { breakpoints, cards, code, list, params, section, steps, text } from './blocks';
import type { GuideSection } from './types';

export const mediaSections: GuideSection[] = [
  section('Для чего нужен media', [
    text(
      '`media` — обычный CSS media query. `source` срабатывает, только если запрос совпал. С его помощью на разных экранах показывают разную композицию, а не просто тот же файл меньшего размера.',
    ),
    breakpoints(),
  ]),
  section('Как писать media', [
    text(
      `Верхняя граница диапазона — на 1 px меньше следующего брейкпоинта, например \`${BP.md - 1}px\`. Тогда диапазоны не пересекаются с CSS (\`min-width: ${BP.md}px\`).`,
    ),
    params([
      {
        term: 'mobile',
        detail: `\`(max-width: ${BP.md - 1}px)\``,
      },
      {
        term: 'md',
        detail: `\`(min-width: ${BP.md}px) and (max-width: ${BP.lg - 1}px)\``,
      },
      {
        term: 'lg',
        detail: `\`(min-width: ${BP.lg}px) and (max-width: ${BP.xl - 1}px)\``,
      },
      {
        term: 'xl',
        detail: `\`(min-width: ${BP.xl}px)\` или \`source\` без \`media\` в самом конце.`,
      },
    ]),
  ]),
  section('Пример: mobile и desktop', [
    text(
      'Самый частый случай: на mobile своя обрезка, с md и выше — общий широкий кадр. Внутри каждого `media` порядок форматов тот же: AVIF, WebP, JPEG.',
    ),
    code(`<picture>
  <!-- mobile -->
  <source media="(max-width: ${BP.md - 1}px)" srcset="hero-mobile.avif" type="image/avif" />
  <source media="(max-width: ${BP.md - 1}px)" srcset="hero-mobile.webp" type="image/webp" />
  <source media="(max-width: ${BP.md - 1}px)" srcset="hero-mobile.jpg" />

  <!-- md и выше -->
  <source srcset="hero-desktop.avif" type="image/avif" />
  <source srcset="hero-desktop.webp" type="image/webp" />
  <img src="hero-desktop.jpg" alt="Hero" width="${BP.xl}" height="720" />
</picture>`),
  ]),
  section('Пример: несколько диапазонов', [
    text(
      'Если на md и lg нужна своя композиция, добавьте по набору `source` на каждый диапазон. Покажу только AVIF — WebP и JPEG пишутся так же.',
    ),
    code(`<picture>
  <source media="(max-width: ${BP.md - 1}px)" srcset="shot-mobile.avif" type="image/avif" />
  <source
    media="(min-width: ${BP.md}px) and (max-width: ${BP.lg - 1}px)"
    srcset="shot-md.avif"
    type="image/avif"
  />
  <source
    media="(min-width: ${BP.lg}px) and (max-width: ${BP.xl - 1}px)"
    srcset="shot-lg.avif"
    type="image/avif"
  />
  <source srcset="shot-xl.avif" type="image/avif" />

  <!-- то же для webp -->

  <img src="shot-xl.jpg" alt="…" width="${BP.xl}" height="720" />
</picture>`),
  ]),
  section('media или srcset', [
    cards([
      {
        title: 'Достаточно srcset и sizes',
        body: 'Композиция одна, меняется только размер файла. Браузер сам выберет подходящий файл из списка.',
      },
      {
        title: 'Нужен media',
        body: 'На разных экранах разная обрезка или вообще другое изображение. `srcset` кадр не меняет.',
      },
    ]),
  ]),
  section('Правила', [
    list([
      `Используйте только брейкпоинты проекта: ${BP.md}, ${BP.lg}, ${BP.xl}.`,
      'Узкие диапазоны — выше, широкие и `source` без `media` — ниже.',
      'Внутри диапазона порядок форматов: AVIF, WebP, JPEG.',
      '`media` учитывает ширину окна, а не колонки. Для слота в сайдбаре используйте `sizes` и `srcset`.',
    ]),
  ]),
  section('Как готовить файлы', [
    steps([
      'Обрежьте исходник под mobile, сделайте Resize и нажмите «Скачать все». Файлы назовите `*-mobile.*`.',
      'Если на md, lg или xl композиция отличается, повторите для каждого диапазона и добавьте суффикс `*-md.*`, `*-lg.*`, `*-xl.*`.',
      'Если с md композиция одинаковая, хватит двух наборов: mobile и desktop.',
    ]),
  ]),
];
