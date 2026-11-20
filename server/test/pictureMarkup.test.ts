import { describe, expect, it } from 'vitest';
import { buildArtDirectionPicture, mediaForTokens } from '../src/pictureMarkup.js';

describe('pictureMarkup', () => {
  it('ставит media от узкого брейкпоинта к широкому и оставляет fallback без media', () => {
    expect(mediaForTokens(['xl', 'md', 'lg'])).toEqual([
      { token: 'md', media: '(max-width: 1023px)' },
      { token: 'lg', media: '(min-width: 1024px) and (max-width: 1279px)' },
      { token: 'xl' },
    ]);
  });

  it('для единственного брейкпоинта не добавляет media', () => {
    expect(mediaForTokens(['md'])).toEqual([{ token: 'md' }]);
  });

  it('собирает picture с 1x/2x и явным fallback', () => {
    expect(
      buildArtDirectionPicture({
        baseName: 'photo',
        tokens: ['md', 'xl'],
        has2x: { md: false },
        fallbackExtension: 'jpg',
        alt: 'Hero',
        imgHeight: 400,
      }),
    ).toBe(`<picture>
  <!-- md: (max-width: 1279px) -->
  <source
    media="(max-width: 1279px)"
    type="image/avif"
    srcset="photo-md.avif 1x"
  />
  <source
    media="(max-width: 1279px)"
    type="image/webp"
    srcset="photo-md.webp 1x"
  />
  <source
    media="(max-width: 1279px)"
    srcset="photo-md.jpg 1x"
  />

  <!-- xl: fallback -->
  <source
    type="image/avif"
    srcset="photo-xl.avif 1x, photo-xl-2x.avif 2x"
  />
  <source
    type="image/webp"
    srcset="photo-xl.webp 1x, photo-xl-2x.webp 2x"
  />
  <source
    srcset="photo-xl.jpg 1x, photo-xl-2x.jpg 2x"
  />

  <img
    src="photo-xl.jpg"
    srcset="photo-xl.jpg 1x, photo-xl-2x.jpg 2x"
    alt="Hero"
    width="1280"
    height="400"
    loading="lazy"
    decoding="async"
  />
</picture>`);
  });

  it('по умолчанию включает 2x и подставляет переданную ширину', () => {
    const html = buildArtDirectionPicture({
      baseName: 'banner',
      tokens: ['lg'],
      has2x: {},
      fallbackExtension: 'png',
      imgWidth: 640,
    });

    expect(html).toContain('src="banner-lg.png"');
    expect(html).toContain('banner-lg.png 1x, banner-lg-2x.png 2x');
    expect(html).toContain('alt=""');
    expect(html).toContain('width="640"');
    expect(html).not.toContain('height=');
    expect(html).not.toContain('media=');
  });
});
