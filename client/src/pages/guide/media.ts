import { BP } from 'shared';
import { breakpoints, cards, code, list, params, section, steps, text } from './blocks';
import type { GuideSection } from './types';

export const mediaSections: GuideSection[] = [
  section('Media под брейкпоинты проекта', [
    text('В `<picture>` чаще всего режем по тем же точкам, что лейаут:'),
    breakpoints(),
    text(
      '`media` — обычный CSS media query. Source участвует только при совпадении. Так меняют обрезку/композицию между mobile, tablet (md), tablet-lg (lg) и desktop (xl) — не просто тот же файл помельче.',
    ),
  ]),
  section('Как писать media', [
    text(
      `Mobile-first: более узкие диапазоны сверху, xl / без media — запасной широкий кадр внизу. Границы — **на пиксель меньше следующего токена**, чтобы не пересекаться с CSS \`min-width: ${BP.md}px\` и т.п.`,
    ),
    params([
      {
        term: 'mobile',
        detail: `\`(max-width: ${BP.md - 1}px)\` — всё до tablet.`,
      },
      {
        term: 'md — tablet',
        detail: `\`(min-width: ${BP.md}px) and (max-width: ${BP.lg - 1}px)\``,
      },
      {
        term: 'lg — tablet-lg / desktop-small',
        detail: `\`(min-width: ${BP.lg}px) and (max-width: ${BP.xl - 1}px)\``,
      },
      {
        term: 'xl — desktop',
        detail: `\`(min-width: ${BP.xl}px)\` или source без media как финальный fallback.`,
      },
    ]),
  ]),
  section('Пример: арт-директинг mobile / md+', [
    text(
      'Частый кейс — другая обрезка до md и общий кадр с md и выше. Внутри каждого media — AVIF → WebP → JPEG.',
    ),
    code(`<picture>
  <!-- mobile: < md (${BP.md}) -->
  <source
    media="(max-width: ${BP.md - 1}px)"
    srcset="hero-mobile.avif"
    type="image/avif"
  />
  <source
    media="(max-width: ${BP.md - 1}px)"
    srcset="hero-mobile.webp"
    type="image/webp"
  />
  <source
    media="(max-width: ${BP.md - 1}px)"
    srcset="hero-mobile.jpg"
  />

  <!-- md+ (tablet → desktop): широкий кадр -->
  <source srcset="hero-desktop.avif" type="image/avif" />
  <source srcset="hero-desktop.webp" type="image/webp" />
  <img src="hero-desktop.jpg" alt="Hero" width="${BP.xl}" height="720" />
</picture>`),
  ]),
  section('Пример: все четыре диапазона', [
    text('Когда на md / lg / xl реально разные композиции (не только ширина файла):'),
    code(`<picture>
  <!-- mobile -->
  <source media="(max-width: ${BP.md - 1}px)" srcset="shot-mobile.avif" type="image/avif" />
  <source media="(max-width: ${BP.md - 1}px)" srcset="shot-mobile.webp" type="image/webp" />
  <source media="(max-width: ${BP.md - 1}px)" srcset="shot-mobile.jpg" />

  <!-- md: tablet -->
  <source
    media="(min-width: ${BP.md}px) and (max-width: ${BP.lg - 1}px)"
    srcset="shot-md.avif"
    type="image/avif"
  />
  <source
    media="(min-width: ${BP.md}px) and (max-width: ${BP.lg - 1}px)"
    srcset="shot-md.webp"
    type="image/webp"
  />
  <source
    media="(min-width: ${BP.md}px) and (max-width: ${BP.lg - 1}px)"
    srcset="shot-md.jpg"
  />

  <!-- lg: tablet-lg / desktop-small -->
  <source
    media="(min-width: ${BP.lg}px) and (max-width: ${BP.xl - 1}px)"
    srcset="shot-lg.avif"
    type="image/avif"
  />
  <source
    media="(min-width: ${BP.lg}px) and (max-width: ${BP.xl - 1}px)"
    srcset="shot-lg.webp"
    type="image/webp"
  />
  <source
    media="(min-width: ${BP.lg}px) and (max-width: ${BP.xl - 1}px)"
    srcset="shot-lg.jpg"
  />

  <!-- xl: desktop -->
  <source srcset="shot-xl.avif" type="image/avif" />
  <source srcset="shot-xl.webp" type="image/webp" />
  <img src="shot-xl.jpg" alt="…" width="${BP.xl}" height="720" />
</picture>`),
  ]),
  section('Когда нужен media, а когда хватит srcset', [
    cards([
      {
        title: 'Только srcset + sizes',
        body: 'Одна композиция на всех брейкпоинтах, меняется лишь разрешение. В `sizes` укажите слот на mobile / md / lg / xl — браузер сам выберет файл из лестницы.',
      },
      {
        title: 'Нужен media',
        body: 'На mobile другая обрезка, на md — ещё одна, на xl — третий. Или другое изображение целиком. Srcset кадр не меняет.',
      },
    ]),
  ]),
  section('Правила', [
    list([
      `Только токены проекта: ${BP.md} / ${BP.lg} / ${BP.xl}. Не вводите «около 700» или «900».`,
      'Более специфичные media выше; xl или source без media — внизу.',
      'Внутри одного диапазона: AVIF → WebP → JPEG.',
      '`media` смотрит на viewport, не на ширину колонки. Слот в сайдбаре — через sizes + srcset.',
    ]),
  ]),
  section('Как готовить файлы в туле', [
    steps([
      'Исходник → обрезка под **mobile** → Resize (см. srcset) → «Скачать все» → `*-mobile.*`.',
      'При необходимости отдельные обрезки для **md**, **lg**, **xl** — каждый своим ZIP с суффиксом `*-md|lg|xl.*`.',
      'Если с md композиция одна — достаточно пары mobile / desktop (md+), как в первом примере.',
    ]),
  ]),
];
