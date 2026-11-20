import { BP } from 'shared';
import { basicsSections } from './basics';
import { mediaSections } from './media';
import { sourceSections } from './source';
import { srcsetSections } from './srcset';
import type { GuideTab } from './types';

/** Inline spans in copy: `code`, **strong**, *em*. Widths come from BP. */
export const GUIDE_INTRO = {
  kicker: 'Документация',
  title: 'Гайд по оптимизации картинок для веба',
  lead: `Подготовка ассетов под \`<picture>\` с брейкпоинтами проекта: **md ${BP.md}**, **lg ${BP.lg}**, **xl ${BP.xl}** — и разрешение под реальный слот в вёрстке.`,
};

export const GUIDE_TABS: GuideTab[] = [
  { id: 'basics', label: 'Основы', hint: 'Форматы и тул', sections: basicsSections },
  { id: 'source', label: 'source', hint: 'Как выбирается файл', sections: sourceSections },
  { id: 'media', label: 'media', hint: 'md / lg / xl', sections: mediaSections },
  { id: 'srcset', label: 'srcset', hint: 'Ширины и ресайз', sections: srcsetSections },
];
