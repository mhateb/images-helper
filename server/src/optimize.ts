import sharp from 'sharp';

export type OutputFormat = 'optimized' | 'webp' | 'avif';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OptimizeOptions {
  format: OutputFormat;
  trim: boolean;
  quality: number;
  crop?: CropRect;
  /** Downscale so width ≤ maxWidth; height follows aspect ratio. No upscale. */
  resizeMaxWidth?: number;
}

export interface PrepareOptions {
  trim: boolean;
  quality: number;
  crop?: CropRect;
  resizeMaxWidth?: number;
}

export interface OptimizeResult {
  buffer: Buffer;
  contentType: string;
  extension: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  originalSize: number;
  optimizedSize: number;
}

export interface OptimizeVariant extends OptimizeResult {
  format: OutputFormat;
}

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
]);

export function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME.has(mime);
}

function clampQuality(quality: number): number {
  return Math.min(100, Math.max(1, Math.round(quality)));
}

function contentTypeFor(format: string): string {
  switch (format) {
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'avif':
      return 'image/avif';
    case 'gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
}

function extensionFor(format: string): string {
  switch (format) {
    case 'jpeg':
      return 'jpg';
    case 'png':
      return 'png';
    case 'webp':
      return 'webp';
    case 'avif':
      return 'avif';
    case 'gif':
      return 'gif';
    default:
      return 'bin';
  }
}

async function applyCrop(input: Buffer, crop: CropRect): Promise<Buffer> {
  const meta = await sharp(input, { failOn: 'none' }).metadata();
  const imageWidth = meta.width ?? 0;
  const imageHeight = meta.height ?? 0;

  if (imageWidth <= 0 || imageHeight <= 0) {
    return input;
  }

  const left = Math.max(0, Math.min(imageWidth - 1, Math.round(crop.x)));
  const top = Math.max(0, Math.min(imageHeight - 1, Math.round(crop.y)));
  const width = Math.max(1, Math.min(imageWidth - left, Math.round(crop.width)));
  const height = Math.max(1, Math.min(imageHeight - top, Math.round(crop.height)));

  // Skip no-op full-frame crops (crop UI always reports an area).
  if (left === 0 && top === 0 && width === imageWidth && height === imageHeight) {
    return input;
  }

  return sharp(input, { failOn: 'none' })
    .extract({ left, top, width, height })
    .toBuffer();
}

async function applyTrim(input: Buffer): Promise<Buffer> {
  try {
    return await sharp(input, { failOn: 'none' })
      .trim({ threshold: 10 })
      .toBuffer();
  } catch {
    // Solid / nearly solid images: trim has nothing useful to cut.
    return input;
  }
}

const MIN_RESIZE_WIDTH = 16;
const MAX_RESIZE_WIDTH = 10000;

function clampResizeMaxWidth(value: number): number {
  return Math.min(MAX_RESIZE_WIDTH, Math.max(MIN_RESIZE_WIDTH, Math.round(value)));
}

async function applyResize(input: Buffer, maxWidth: number): Promise<Buffer> {
  const width = clampResizeMaxWidth(maxWidth);
  const meta = await sharp(input, { failOn: 'none' }).metadata();
  const imageWidth = meta.width ?? 0;

  if (imageWidth <= 0 || imageWidth <= width) {
    return input;
  }

  return sharp(input, { failOn: 'none' })
    .resize({
      width,
      withoutEnlargement: true,
      fit: 'inside',
    })
    .toBuffer();
}

async function prepareBuffer(
  input: Buffer,
  options: Pick<PrepareOptions, 'trim' | 'crop' | 'resizeMaxWidth'>,
): Promise<{
  buffer: Buffer;
  inputFormat: string;
  originalWidth: number;
  originalHeight: number;
}> {
  const meta = await sharp(input, { animated: false, failOn: 'none' }).metadata();

  // Orient first so crop coords match what the browser shows.
  let buffer = await sharp(input, { animated: false, failOn: 'none' })
    .rotate()
    .toBuffer();

  const oriented = await sharp(buffer, { failOn: 'none' }).metadata();
  const originalWidth = oriented.width ?? meta.width ?? 0;
  const originalHeight = oriented.height ?? meta.height ?? 0;

  if (options.crop) {
    buffer = await applyCrop(buffer, options.crop);
  }

  // trim must run in a separate sharp instance after extract —
  // chaining extract().trim() in one pipeline throws "bad extract area".
  if (options.trim) {
    buffer = await applyTrim(buffer);
  }

  if (options.resizeMaxWidth != null) {
    buffer = await applyResize(buffer, options.resizeMaxWidth);
  }

  return {
    buffer,
    inputFormat: meta.format ?? 'jpeg',
    originalWidth,
    originalHeight,
  };
}

async function encodeBuffer(
  buffer: Buffer,
  inputFormat: string,
  format: OutputFormat,
  quality: number,
  originalSize: number,
  originalWidth: number,
  originalHeight: number,
): Promise<OptimizeResult> {
  let outputFormat: 'jpeg' | 'png' | 'webp' | 'avif' | 'gif';
  let pipeline = sharp(buffer, { failOn: 'none' });

  if (format === 'webp') {
    outputFormat = 'webp';
    pipeline = pipeline.webp({ quality, effort: 4 });
  } else if (format === 'avif') {
    outputFormat = 'avif';
    pipeline = pipeline.avif({ quality, effort: 4 });
  } else {
    switch (inputFormat) {
      case 'png':
        outputFormat = 'png';
        pipeline = pipeline.png({ compressionLevel: 9, effort: 7 });
        break;
      case 'webp':
        outputFormat = 'webp';
        pipeline = pipeline.webp({ quality, effort: 4 });
        break;
      case 'avif':
        outputFormat = 'avif';
        pipeline = pipeline.avif({ quality, effort: 4 });
        break;
      case 'gif':
        outputFormat = 'png';
        pipeline = pipeline.png({ compressionLevel: 9, effort: 7 });
        break;
      default:
        outputFormat = 'jpeg';
        pipeline = pipeline.jpeg({ quality, mozjpeg: true });
        break;
    }
  }

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    contentType: contentTypeFor(outputFormat),
    extension: extensionFor(outputFormat),
    width: info.width,
    height: info.height,
    originalWidth,
    originalHeight,
    originalSize,
    optimizedSize: data.length,
  };
}

export async function optimizeImage(
  input: Buffer,
  originalSize: number,
  options: OptimizeOptions,
): Promise<OptimizeResult> {
  const quality = clampQuality(options.quality);
  const prepared = await prepareBuffer(input, options);
  return encodeBuffer(
    prepared.buffer,
    prepared.inputFormat,
    options.format,
    quality,
    originalSize,
    prepared.originalWidth,
    prepared.originalHeight,
  );
}

export async function optimizeAllFormats(
  input: Buffer,
  originalSize: number,
  options: PrepareOptions,
): Promise<OptimizeVariant[]> {
  const quality = clampQuality(options.quality);
  const prepared = await prepareBuffer(input, options);
  const formats: OutputFormat[] = ['optimized', 'webp', 'avif'];

  const results = await Promise.all(
    formats.map(async (format) => {
      const result = await encodeBuffer(
        prepared.buffer,
        prepared.inputFormat,
        format,
        quality,
        originalSize,
        prepared.originalWidth,
        prepared.originalHeight,
      );
      return {
        ...result,
        format,
      };
    }),
  );

  return results;
}
