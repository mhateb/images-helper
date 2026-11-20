import { useCallback, useEffect, useState } from 'react';
import { optimizeImage } from '../api/optimize';
import { trackGoal, YM_GOALS } from '../analytics/ym';
import {
  fileNamesSummary,
  sortFormats,
  type ImageItem,
} from '../pages/home/imageItem';
import type { OptimizeResult, OutputFormat } from '../types';

export function useImageOptimize(
  items: ImageItem[],
  activeId: string | null,
  originalWidth: number | null,
  replaceResults: (id: string, results: OptimizeResult[], error: string | null) => void,
) {
  const [formats, setFormats] = useState<OutputFormat[]>(['optimized']);
  const [previewFormat, setPreviewFormat] = useState<OutputFormat>('optimized');
  const [trim, setTrim] = useState(false);
  const [resize, setResize] = useState(false);
  const [resizeMaxWidth, setResizeMaxWidth] = useState(1920);
  const [quality, setQuality] = useState(80);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    if (originalWidth != null) setResizeMaxWidth(originalWidth);
  }, [activeId, originalWidth]);

  const clearProgress = useCallback(() => {
    setProgress(null);
  }, []);

  const runOptimize = useCallback(
    async (nextFormats: OutputFormat[] = formats, onlyId?: string) => {
      const selected = sortFormats(nextFormats);
      if (selected.length === 0) return;

      const targets = onlyId ? items.filter((item) => item.id === onlyId) : items;
      if (targets.length === 0 || busy) return;

      const hasCrop = targets.some((item) => Boolean(item.crop));
      trackGoal(YM_GOALS.optimizeStart, {
        files_count: targets.length,
        formats: selected.join(','),
        quality,
        trim,
        resize,
        has_crop: hasCrop,
      });

      setBusy(true);
      const total = targets.length * selected.length;
      setProgress({ done: 0, total });
      setFormats(selected);
      setPreviewFormat(selected[0]);

      const startedAt = performance.now();
      let done = 0;
      let okCount = 0;
      let failCount = 0;
      let originalBytes = 0;
      let optimizedBytes = 0;
      const okFileNames: string[] = [];

      for (const item of targets) {
        const nextResults: OptimizeResult[] = [];
        let lastError: string | null = null;

        for (const format of selected) {
          try {
            const data = await optimizeImage({
              file: item.file,
              format,
              trim,
              quality,
              resize,
              resizeMaxWidth,
              crop: item.crop,
            });
            nextResults.push(data);
            originalBytes += data.originalSize;
            optimizedBytes += data.optimizedSize;
          } catch (error) {
            lastError =
              error instanceof Error ? error.message : 'Не удалось оптимизировать изображение.';
          }

          done += 1;
          setProgress({ done, total });
        }

        if (nextResults.length > 0) {
          okCount += 1;
          okFileNames.push(item.file.name);
        } else {
          failCount += 1;
        }

        replaceResults(item.id, nextResults, nextResults.length > 0 ? null : lastError);
      }

      setBusy(false);
      setProgress(null);

      const durationMs = Math.round(performance.now() - startedAt);
      const savedBytes = Math.max(0, originalBytes - optimizedBytes);
      const savedPct = originalBytes > 0 ? Math.round((savedBytes / originalBytes) * 100) : 0;

      if (okCount > 0) {
        trackGoal(YM_GOALS.optimizeSuccess, {
          files_count: targets.length,
          formats: selected.join(','),
          ok_count: okCount,
          fail_count: failCount,
          original_bytes: originalBytes,
          optimized_bytes: optimizedBytes,
          saved_bytes: savedBytes,
          saved_pct: savedPct,
          duration_ms: durationMs,
          has_crop: hasCrop,
          file_name: fileNamesSummary(okFileNames),
        });
      }

      if (failCount > 0) {
        trackGoal(YM_GOALS.optimizeError, {
          files_count: targets.length,
          formats: selected.join(','),
          ok_count: okCount,
          fail_count: failCount,
          error_stage: 'api',
          duration_ms: durationMs,
        });
      }
    },
    [busy, formats, items, quality, replaceResults, resize, resizeMaxWidth, trim],
  );

  return {
    formats,
    setFormats,
    previewFormat,
    setPreviewFormat,
    trim,
    setTrim,
    resize,
    setResize,
    resizeMaxWidth,
    setResizeMaxWidth,
    quality,
    setQuality,
    busy,
    progress,
    clearProgress,
    runOptimize,
  };
}
