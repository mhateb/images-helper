import { BP } from 'shared';
import { breakpoints, callout, code, list, params, section, steps, text } from './blocks';
import type { GuideSection } from './types';

export const srcsetSections: GuideSection[] = [
  section('Srcset под слоты md / lg / xl', [
    text(
      'Лестницу ширин и `sizes` строим от брейкпоинтов проекта. Браузер выбирает файл ≈ `CSS-ширина слота × devicePixelRatio`.',
    ),
    breakpoints(),
    code(`<picture>
  <source
    type="image/avif"
    srcset="
      card-${BP.md}.avif ${BP.md}w,
      card-${BP.lg}.avif ${BP.lg}w,
      card-${BP.xl}.avif ${BP.xl}w,
      card-${BP.xl * 2}.avif ${BP.xl * 2}w
    "
    sizes="
      (max-width: ${BP.md - 1}px) 100vw,
      (max-width: ${BP.lg - 1}px) 50vw,
      (max-width: ${BP.xl - 1}px) 400px,
      400px
    "
  />
  <source
    type="image/webp"
    srcset="
      card-${BP.md}.webp ${BP.md}w,
      card-${BP.lg}.webp ${BP.lg}w,
      card-${BP.xl}.webp ${BP.xl}w,
      card-${BP.xl * 2}.webp ${BP.xl * 2}w
    "
    sizes="
      (max-width: ${BP.md - 1}px) 100vw,
      (max-width: ${BP.lg - 1}px) 50vw,
      (max-width: ${BP.xl - 1}px) 400px,
      400px
    "
  />
  <img
    src="card-${BP.lg}.jpg"
    srcset="
      card-${BP.md}.jpg ${BP.md}w,
      card-${BP.lg}.jpg ${BP.lg}w,
      card-${BP.xl}.jpg ${BP.xl}w,
      card-${BP.xl * 2}.jpg ${BP.xl * 2}w
    "
    sizes="
      (max-width: ${BP.md - 1}px) 100vw,
      (max-width: ${BP.lg - 1}px) 50vw,
      (max-width: ${BP.xl - 1}px) 400px,
      400px
    "
    alt="Карточка"
    width="400"
    height="300"
  />
</picture>`),
  ]),
  section('sizes на брейкпоинтах проекта', [
    params([
      {
        term: `(max-width: ${BP.md - 1}px) — mobile`,
        detail: 'Часто `100vw` для full-bleed или доля колонки, как в макете.',
      },
      {
        term: `(max-width: ${BP.lg - 1}px) — до lg (включая md)`,
        detail: 'Слот tablet: например `50vw` в двухколоночной сетке.',
      },
      {
        term: `(max-width: ${BP.xl - 1}px) — lg`,
        detail: 'tablet-lg / desktop-small — фиксированный слот или vw из вёрстки.',
      },
      {
        term: 'хвост — xl+',
        detail:
          'Финальное значение без media (например `400px` или `33vw`) для desktop.',
      },
    ]),
    text(
      'w-дескриптор — реальная ширина файла в пикселях; она должна совпадать с Resize в туле.',
    ),
  ]),
  section('Какие ширины резать в туле', [
    text(
      'Базовые ступени = токены брейкпоинтов. Для retina добавьте ×2. Не плодите лишние промежутки.',
    ),
    list([
      '**Фиксированный слот ~300px** (как пачка жвачки во вкладке Основы) — один файл 600w = 300 × 2. Лестница md/lg не нужна, если ширина в макете не растёт.',
      `**Карточка ~320–400px** с разной шириной по брейкпоинтам — ${BP.md} / ${BP.lg} (иногда ${BP.xl} под 3×).`,
      `**Контентная колонка / полширины** — ${BP.md} / ${BP.lg} / ${BP.xl} / ${BP.xl * 2}.`,
      `**Full-bleed hero** — ${BP.md} / ${BP.lg} / ${BP.xl} / ${BP.xl * 2}; при full-bleed на lg с DPR=2 добавьте ещё ${BP.lg * 2}.`,
    ]),
    callout(
      `Пример: слот на xl = 400px, DPR=2 → нужно ~800px → хватит кандидата ${BP.lg}w или ближайшего большего. Файл ${BP.xl * 2}w на узкую карточку почти не нужен.`,
    ),
  ]),
  section('Прогон в туле', [
    steps([
      'Одна обрезка и автообрезка краёв на всю лестницу (одна композиция).',
      `Resize = ${BP.md} → «Скачать все» → \`name-${BP.md}.avif|webp|jpg\`.`,
      `Resize = ${BP.lg} → ZIP → \`name-${BP.lg}.*\`.`,
      `Resize = ${BP.xl} → ZIP → \`name-${BP.xl}.*\`.`,
      `При необходимости Resize = ${BP.xl * 2} (retina desktop) → \`name-${BP.xl * 2}.*\`.`,
      'В srcset у каждого файла тот же `Nw`; один `sizes` на все source и img.',
    ]),
  ]),
  section('media + srcset вместе', [
    text(
      `Разная обрезка на mobile и md+ — вкладка **media**. Внутри каждого media можно дать свою лестницу \`${BP.md}w, ${BP.lg}w…\`, если слот сильно гуляет внутри диапазона. Часто для mobile хватает 1–2 ширин, для md+ — полной лестницы до ${BP.xl} / ${BP.xl * 2}.`,
    ),
  ]),
  section('Когда урезать', [
    list([
      `Исходник шире верхнего кандидата (сток 4000px, лестница до ${BP.xl * 2}) — режьте.`,
      `Слот маленький — не тащите hero ${BP.xl * 2} «на будущее».`,
      'Разные обрезки mobile / md / lg / xl — сначала media-композиции, потом ресайз каждой.',
      `Не апскейльте: исходник 900px и кандидат ${BP.xl}w бессмысленны — тул не увеличит, дескриптор обманет браузер.`,
    ]),
  ]),
];
