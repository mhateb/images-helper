import { MAX_FILES } from 'shared';
import type { CropArea, OptimizeResult, OutputFormat } from '../../types';

export { MAX_FILES };

const FORMAT_ORDER: OutputFormat[] = ['optimized', 'webp', 'avif'];

export interface ImageItem {
  id: string;
  file: File;
  imageUrl: string;
  dimensions: { w: number; h: number } | null;
  crop?: CropArea;
  results: OptimizeResult[];
  error: string | null;
}

export function formatLabel(type: string): string {
  const map: Record<string, string> = {
    'image/png': 'PNG',
    'image/jpeg': 'JPEG',
    'image/webp': 'WEBP',
    'image/avif': 'AVIF',
    'image/gif': 'GIF',
  };
  return map[type] || type.replace('image/', '').toUpperCase() || 'IMAGE';
}

export function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function loadDimensions(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error('Не удалось прочитать изображение'));
    img.src = url;
  });
}

export function revokeResults(results: OptimizeResult[]) {
  for (const result of results) URL.revokeObjectURL(result.url);
}

export function sortFormats(formats: OutputFormat[]): OutputFormat[] {
  return FORMAT_ORDER.filter((format) => formats.includes(format));
}

export function mimeSummary(files: File[]): string {
  const types = [...new Set(files.map((file) => formatLabel(file.type)))];
  return types.slice(0, 5).join(',');
}

/** Keep Metrika visit-param values within a safe length. */
export function fileNamesSummary(names: string[], maxLen = 200): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0].slice(0, maxLen);

  const joined = names.join(',');
  if (joined.length <= maxLen) return joined;

  const kept: string[] = [];
  let len = 0;
  for (const name of names) {
    const next = kept.length === 0 ? name : `,${name}`;
    if (len + next.length > maxLen - 12) break;
    kept.push(name);
    len += next.length;
  }
  const rest = names.length - kept.length;
  return rest > 0 ? `${kept.join(',')},+${rest}` : kept.join(',');
}

export function pickPreviewFormat(
  results: OptimizeResult[],
  preferred?: OutputFormat | null,
): OutputFormat | null {
  if (results.length === 0) return null;
  if (preferred && results.some((item) => item.format === preferred)) {
    return preferred;
  }
  return results[0].format;
}

export function fileCountLabel(count: number): string {
  if (count === 1) return 'файл';
  if (count < 5) return 'файла';
  return 'файлов';
}
