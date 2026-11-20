import { BP, mediaForTokens, type BreakpointToken } from './breakpoints.js';

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
  has2x?: Partial<Record<BreakpointToken, boolean>>;
  fallbackExtension?: string;
  alt?: string;
  imgWidth?: number;
  imgHeight?: number;
}): string {
  const { baseName, tokens } = options;
  const has2x = options.has2x ?? {};
  const fallbackExtension = options.fallbackExtension ?? 'jpg';
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

export function expectedArtFilenames(
  baseName: string,
  tokens: BreakpointToken[],
  has2x: Partial<Record<BreakpointToken, boolean>> = {},
  fallbackExtension = 'jpg',
): string[] {
  const names: string[] = [];
  for (const token of tokens) {
    for (const ext of ['avif', 'webp', fallbackExtension]) {
      names.push(`${baseName}-${token}.${ext}`);
      if (has2x[token] !== false) {
        names.push(`${baseName}-${token}-2x.${ext}`);
      }
    }
  }
  return names;
}
