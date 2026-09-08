import { BP } from './optimize.js';
import type { BreakpointToken } from './optimize.js';

/** Media queries for filled breakpoints, narrow → wide. Last has no media (fallback). */
export function mediaForTokens(
  tokens: BreakpointToken[],
): { token: BreakpointToken; media?: string }[] {
  const order: BreakpointToken[] = ['md', 'lg', 'xl'];
  const present = order.filter((token) => tokens.includes(token));

  return present.map((token, index) => {
    const isLast = index === present.length - 1;
    if (isLast) return { token };

    const next = present[index + 1];
    const nextBp = BP[next];

    if (index === 0) {
      return { token, media: `(max-width: ${nextBp - 1}px)` };
    }

    return {
      token,
      media: `(min-width: ${BP[token]}px) and (max-width: ${nextBp - 1}px)`,
    };
  });
}

function densitySrcset(
  baseName: string,
  token: BreakpointToken,
  ext: string,
  has2x: boolean,
): string {
  const oneX = `${baseName}-${token}.${ext} 1x`;
  if (!has2x) return oneX;
  return `${oneX}, ${baseName}-${token}-2x.${ext} 2x`;
}

/** Art-direction `<picture>` with media per md / lg / xl and 1x/2x density. */
export function buildArtDirectionPicture(options: {
  baseName: string;
  tokens: BreakpointToken[];
  /** Which tokens have a distinct 2x file */
  has2x: Partial<Record<BreakpointToken, boolean>>;
  fallbackExtension: string;
  alt?: string;
  imgWidth?: number;
  imgHeight?: number;
}): string {
  const { baseName, tokens, has2x, fallbackExtension } = options;
  const alt = options.alt ?? '';
  const ranges = mediaForTokens(tokens);
  const fallbackToken = ranges[ranges.length - 1]?.token ?? 'xl';
  const imgWidth = options.imgWidth ?? BP[fallbackToken];
  const heightAttr =
    options.imgHeight != null && options.imgHeight > 0
      ? `\n    height="${options.imgHeight}"`
      : '';

  const blocks: string[] = [];

  for (const { token, media } of ranges) {
    const twoX = has2x[token] !== false;
    const mediaAttr = media ? `\n    media="${media}"` : '';
    const comment = media
      ? `  <!-- ${token}: ${media} -->`
      : `  <!-- ${token}: fallback -->`;

    blocks.push(`${comment}
  <source${mediaAttr}
    type="image/avif"
    srcset="${densitySrcset(baseName, token, 'avif', twoX)}"
  />
  <source${mediaAttr}
    type="image/webp"
    srcset="${densitySrcset(baseName, token, 'webp', twoX)}"
  />
  <source${mediaAttr}
    srcset="${densitySrcset(baseName, token, fallbackExtension, twoX)}"
  />`);
  }

  return `<picture>
${blocks.join('\n\n')}

  <img
    src="${baseName}-${fallbackToken}.${fallbackExtension}"
    srcset="${densitySrcset(baseName, fallbackToken, fallbackExtension, has2x[fallbackToken] !== false)}"
    alt="${alt}"
    width="${imgWidth}"${heightAttr}
    loading="lazy"
    decoding="async"
  />
</picture>`;
}
