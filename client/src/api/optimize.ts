import type { OptimizeParams, OptimizeResult } from '../types';

type OptimizeAllParams = Omit<OptimizeParams, 'format'>;

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

  if (params.crop) {
    form.append('cropX', String(params.crop.x));
    form.append('cropY', String(params.crop.y));
    form.append('cropWidth', String(params.crop.width));
    form.append('cropHeight', String(params.crop.height));
  }
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
