import type {
  ArtDirectionParams,
  ArtDirectionResult,
  BreakpointToken,
  OptimizeParams,
  OptimizeResult,
} from '../types';

type OptimizeAllParams = Omit<OptimizeParams, 'format'>;

function appendCropFields(
  form: FormData,
  crop: OptimizeParams['crop'],
  prefix = 'crop',
) {
  if (!crop) return;
  form.append(`${prefix}X`, String(crop.x));
  form.append(`${prefix}Y`, String(crop.y));
  form.append(`${prefix}Width`, String(crop.width));
  form.append(`${prefix}Height`, String(crop.height));
}

function appendOptimizeFields(
  form: FormData,
  params: OptimizeAllParams & { format?: OptimizeParams['format'] },
) {
  form.append('image', params.file);
  if (params.format) {
    form.append('format', params.format);
  }
  form.append('trim', String(params.trim));
  form.append('quality', String(params.quality));
  form.append('resize', String(params.resize));
  if (params.resize) {
    form.append('resizeMaxWidth', String(params.resizeMaxWidth));
  }

  appendCropFields(form, params.crop);
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    if (data.error) return data.error;
  } catch {
    // ignore
  }
  return fallback;
}

export async function optimizeImage(params: OptimizeParams): Promise<OptimizeResult> {
  const form = new FormData();
  appendOptimizeFields(form, params);

  const response = await fetch('/api/optimize', {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Ошибка оптимизации'));
  }

  const blob = await response.blob();
  const originalSize = Number(response.headers.get('X-Original-Size') ?? params.file.size);
  const optimizedSize = Number(response.headers.get('X-Optimized-Size') ?? blob.size);
  const width = Number(response.headers.get('X-Width') ?? 0);
  const height = Number(response.headers.get('X-Height') ?? 0);
  const originalWidth = Number(response.headers.get('X-Original-Width') ?? 0);
  const originalHeight = Number(response.headers.get('X-Original-Height') ?? 0);
  const extension = response.headers.get('X-Extension') ?? 'bin';

  return {
    blob,
    url: URL.createObjectURL(blob),
    originalSize,
    optimizedSize,
    width,
    height,
    originalWidth,
    originalHeight,
    extension,
    format: params.format,
  };
}

export async function downloadAllFormats(params: OptimizeAllParams): Promise<void> {
  const form = new FormData();
  appendOptimizeFields(form, params);

  const response = await fetch('/api/optimize-all', {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Не удалось скачать все форматы'));
  }

  const blob = await response.blob();
  const base = params.file.name.replace(/\.[^.]+$/, '') || 'image';
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${base}.zip`;
  link.click();
  URL.revokeObjectURL(url);
}

function sanitizeBaseName(fallbackFile: File | undefined, override?: string): string {
  const raw = (
    override?.trim() ||
    fallbackFile?.name.replace(/\.[^.]+$/, '') ||
    'image'
  ).trim();
  const cleaned = raw
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || 'image';
}

const FILE_FIELD: Record<BreakpointToken, string> = {
  md: 'imageMd',
  lg: 'imageLg',
  xl: 'imageXl',
};

const CROP_PREFIX: Record<BreakpointToken, string> = {
  md: 'cropMd',
  lg: 'cropLg',
  xl: 'cropXl',
};

export async function generateArtDirection(
  params: ArtDirectionParams,
): Promise<ArtDirectionResult> {
  if (!params.slots.xl?.file) {
    throw new Error('Нужен исходник для xl.');
  }

  const baseName = sanitizeBaseName(params.slots.xl.file, params.baseName);
  const form = new FormData();
  form.append('trim', String(params.trim));
  form.append('quality', String(params.quality));
  form.append('baseName', baseName);

  for (const token of ['md', 'lg', 'xl'] as BreakpointToken[]) {
    const slot = params.slots[token];
    if (!slot) continue;
    form.append(FILE_FIELD[token], slot.file);
    appendCropFields(form, slot.crop, CROP_PREFIX[token]);
  }

  const response = await fetch('/api/optimize-responsive', {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Не удалось собрать picture'));
  }

  const zipBlob = await response.blob();
  const tokens = (response.headers.get('X-Tokens') ?? 'xl')
    .split(',')
    .map((part) => part.trim())
    .filter((part): part is BreakpointToken => part === 'md' || part === 'lg' || part === 'xl');
  const has2xTokens = new Set(
    (response.headers.get('X-Has-2x') ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean),
  );
  const has2x: Partial<Record<BreakpointToken, boolean>> = {};
  for (const token of tokens) {
    has2x[token] = has2xTokens.has(token);
  }
  const fallbackExtension = response.headers.get('X-Fallback-Extension') ?? 'jpg';
  const imgWidth = Number(response.headers.get('X-Img-Width') ?? 0);
  const imgHeight = Number(response.headers.get('X-Img-Height') ?? 0);

  return {
    zipBlob,
    tokens,
    has2x,
    fallbackExtension,
    imgWidth: imgWidth > 0 ? imgWidth : undefined,
    imgHeight: imgHeight > 0 ? imgHeight : undefined,
    downloadName: `${baseName}-responsive.zip`,
  };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function uniqueZipName(base: string, extension: string, used: Set<string>): string {
  let name = `${base}.${extension}`;
  if (!used.has(name)) {
    used.add(name);
    return name;
  }

  let index = 2;
  while (used.has(`${base}-${index}.${extension}`)) {
    index += 1;
  }
  name = `${base}-${index}.${extension}`;
  used.add(name);
  return name;
}

export async function downloadResultsZip(
  files: Array<{ fileName: string; blob: Blob; extension: string }>,
  zipName = 'fitpix-results.zip',
): Promise<void> {
  if (files.length === 0) return;

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const used = new Set<string>();

  for (const file of files) {
    const base = file.fileName.replace(/\.[^.]+$/, '') || 'image';
    const name = uniqueZipName(base, file.extension, used);
    zip.file(name, file.blob);
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  downloadBlob(blob, zipName);
}
