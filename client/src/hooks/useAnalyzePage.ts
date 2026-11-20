import { useMemo, useState, type FormEvent } from 'react';
import {
  ANALYZE_LIMITS,
  analyzePageUrl,
  downloadOptimizedZip,
  fetchAnalyzeImage,
  type AnalyzedImage,
  type AnalyzePageResult,
} from '../api/analyze';
import { trackGoal, YM_GOALS } from '../analytics/ym';
import { formatBytes } from '../utils/format';
import { setHandoffFiles } from '../utils/imageHandoff';
import { pickZipCandidates } from '../pages/analyze/labels';

export type AnalyzeStatus = 'idle' | 'loading' | 'done' | 'error';

function urlHost(value: string): string {
  try {
    return new URL(value.startsWith('http') ? value : `https://${value}`).hostname;
  } catch {
    return 'invalid';
  }
}

export function useAnalyzePage(onNavigate: (to: string) => void) {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<AnalyzeStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzePageResult | null>(null);
  const [zipBusy, setZipBusy] = useState(false);
  const [zipMessage, setZipMessage] = useState<string | null>(null);
  const [openingUrl, setOpeningUrl] = useState<string | null>(null);

  const zipCandidates = useMemo(
    () => (result ? pickZipCandidates(result.images) : []),
    [result],
  );

  const openInTool = async (image: AnalyzedImage) => {
    if (openingUrl || image.error) return;
    setOpeningUrl(image.url);
    setZipMessage(null);
    try {
      const file = await fetchAnalyzeImage(image.url);
      setHandoffFiles([file]);
      trackGoal(YM_GOALS.analyzeOpenInTool, {
        file_name: file.name.slice(0, 80),
      });
      onNavigate('/');
    } catch (err) {
      setZipMessage(
        err instanceof Error ? err.message : 'Не удалось открыть изображение в инструменте.',
      );
    } finally {
      setOpeningUrl(null);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || status === 'loading') return;

    setStatus('loading');
    setError(null);
    setResult(null);
    setZipMessage(null);
    trackGoal(YM_GOALS.analyzeStart, { url_host: urlHost(trimmed) });

    const startedAt = performance.now();
    try {
      const data = await analyzePageUrl(trimmed);
      setResult(data);
      setStatus('done');
      trackGoal(YM_GOALS.analyzeSuccess, {
        image_count: data.imageCount,
        analyzed_count: data.analyzedCount,
        saved_bytes: data.savedBytes,
        saved_pct: data.savedPercent,
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось проанализировать страницу.';
      setError(message);
      setStatus('error');
      trackGoal(YM_GOALS.analyzeError, {
        duration_ms: Math.round(performance.now() - startedAt),
      });
    }
  };

  const onDownloadZip = async () => {
    if (!result || zipBusy || zipCandidates.length === 0) return;

    setZipBusy(true);
    setZipMessage(null);
    trackGoal(YM_GOALS.analyzeZipStart, {
      files_count: zipCandidates.length,
      image_count: result.imageCount,
    });

    try {
      const zip = await downloadOptimizedZip({
        pageUrl: result.finalUrl,
        imageUrls: zipCandidates.map((image) => image.url),
      });
      const parts = [`Скачан архив: ${zip.included} файл(ов) в WebP`];
      if (zip.failed > 0) parts.push(`не удалось: ${zip.failed}`);
      if (zip.skippedBudget > 0) {
        parts.push(
          `пропущено по лимиту ${formatBytes(ANALYZE_LIMITS.maxZipSourceBytes)}: ${zip.skippedBudget}`,
        );
      }
      setZipMessage(parts.join(' · '));
      trackGoal(YM_GOALS.analyzeZipSuccess, {
        files_count: zip.included,
        fail_count: zip.failed,
        skipped_budget: zip.skippedBudget,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось скачать архив.';
      setZipMessage(message);
      trackGoal(YM_GOALS.analyzeZipError);
    } finally {
      setZipBusy(false);
    }
  };

  return {
    url,
    setUrl,
    status,
    error,
    result,
    zipBusy,
    zipMessage,
    openingUrl,
    zipCandidates,
    onSubmit,
    onDownloadZip,
    openInTool,
  };
}
