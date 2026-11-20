import {
  ANALYZE_LIMITS,
  type AnalyzedImage,
  type FormatEstimate,
  type FormatEstimates,
} from '../../api/analyze';
import { formatBytes } from '../../utils/format';

export type EstimateKey = keyof FormatEstimates;

export const FORMAT_CARDS: {
  key: EstimateKey;
  title: string;
  hint: string;
}[] = [
  {
    key: 'optimized',
    title: 'Исходный формат',
    hint: 'Пережатие JPEG/PNG/WebP без смены формата',
  },
  {
    key: 'webp',
    title: 'WebP',
    hint: 'Универсальный вариант для веба, q80',
  },
  {
    key: 'avif',
    title: 'AVIF',
    hint: 'Обычно самый лёгкий, q80',
  },
];

export function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function formatLabel(contentType: string, fileName: string): string {
  const fromMime = contentType.replace(/^image\//i, '').toUpperCase();
  if (fromMime && fromMime !== contentType.toUpperCase()) {
    return fromMime === 'JPEG' ? 'JPEG' : fromMime;
  }
  const ext = fileName.split('.').pop()?.toUpperCase();
  if (!ext) return 'IMG';
  if (ext === 'JPG' || ext === 'JPEG') return 'JPEG';
  return ext.slice(0, 5);
}

export function pickZipCandidates(images: AnalyzedImage[]): AnalyzedImage[] {
  return images
    .filter((image) => !image.error && image.originalBytes > 0 && image.optimizedBytes > 0)
    .sort((a, b) => b.savedBytes - a.savedBytes || b.originalBytes - a.originalBytes)
    .slice(0, ANALYZE_LIMITS.maxZipImages);
}

export function estimateCell(estimate?: FormatEstimate) {
  if (!estimate || estimate.optimizedBytes <= 0) {
    return { size: '—', save: null as string | null };
  }
  return {
    size: formatBytes(estimate.optimizedBytes),
    save: estimate.savedPercent > 0 ? `−${estimate.savedPercent}%` : '0%',
  };
}
