export type AnalyzedImage = {
  url: string;
  fileName: string;
  originalBytes: number;
  optimizedBytes: number;
  savedBytes: number;
  savedPercent: number;
  width: number;
  height: number;
  contentType: string;
  thumbnailDataUrl: string | null;
  error: string | null;
};

export type AnalyzePageResult = {
  url: string;
  finalUrl: string;
  imageCount: number;
  analyzedCount: number;
  skippedCount: number;
  truncated: boolean;
  totalBytes: number;
  optimizedBytes: number;
  savedBytes: number;
  savedPercent: number;
  images: AnalyzedImage[];
};

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    if (data.error) return data.error;
  } catch {
    // ignore
  }
  return fallback;
}

/** Keep in sync with server ANALYZE_LIMITS. */
export const ANALYZE_LIMITS = {
  maxAnalyzeImages: 40,
  maxZipImages: 20,
  maxZipSourceBytes: 40 * 1024 * 1024,
} as const;

export type AnalyzeZipDownload = {
  included: number;
  failed: number;
  skippedBudget: number;
  requested: number;
};

export async function analyzePageUrl(url: string): Promise<AnalyzePageResult> {
  const response = await fetch('/api/analyze-page', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Не удалось проанализировать страницу'));
  }

  return (await response.json()) as AnalyzePageResult;
}

export async function downloadOptimizedZip(params: {
  pageUrl: string;
  imageUrls: string[];
}): Promise<AnalyzeZipDownload> {
  const response = await fetch('/api/analyze-download-zip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pageUrl: params.pageUrl,
      urls: params.imageUrls.slice(0, ANALYZE_LIMITS.maxZipImages),
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Не удалось скачать архив'));
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const matched = disposition.match(/filename="([^"]+)"/i);
  const filename = matched?.[1] || 'fitpix-optimized.zip';

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);

  return {
    included: Number(response.headers.get('X-Zip-Included') ?? 0),
    failed: Number(response.headers.get('X-Zip-Failed') ?? 0),
    skippedBudget: Number(response.headers.get('X-Zip-Skipped-Budget') ?? 0),
    requested: Number(response.headers.get('X-Zip-Requested') ?? params.imageUrls.length),
  };
}
