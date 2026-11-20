import { useState } from 'react';
import { downloadAllFormats, downloadResultsZip } from '../api/optimize';
import { trackGoal, YM_GOALS } from '../analytics/ym';
import type { ImageItem } from '../pages/home/imageItem';

export function useResultDownloads({
  active,
  items,
  trim,
  quality,
  resize,
  resizeMaxWidth,
}: {
  active: ImageItem | null;
  items: ImageItem[];
  trim: boolean;
  quality: number;
  resize: boolean;
  resizeMaxWidth: number;
}) {
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [zippingResults, setZippingResults] = useState(false);
  const [downloadAllError, setDownloadAllError] = useState<string | null>(null);

  const clearError = () => setDownloadAllError(null);

  const onDownload = async () => {
    if (!active || active.results.length === 0) return;
    const base = active.file.name.replace(/\.[^.]+$/, '') || 'image';
    const formatsList = active.results.map((result) => result.format).join(',');

    if (active.results.length === 1) {
      const result = active.results[0];
      const link = document.createElement('a');
      link.href = result.url;
      link.download = `${base}.${result.extension}`;
      link.click();
      trackGoal(YM_GOALS.download, {
        download_type: 'single',
        files_count: 1,
        formats: formatsList,
      });
      return;
    }

    setZippingResults(true);
    setDownloadAllError(null);
    try {
      await downloadResultsZip(
        active.results.map((result) => ({
          fileName: `${base}.${result.extension}`,
          blob: result.blob,
          extension: result.extension,
        })),
        `${base}.zip`,
      );
      trackGoal(YM_GOALS.download, {
        download_type: 'active_zip',
        files_count: 1,
        formats: formatsList,
      });
    } catch (error) {
      setDownloadAllError(error instanceof Error ? error.message : 'Не удалось собрать ZIP.');
    } finally {
      setZippingResults(false);
    }
  };

  const onDownloadAll = async () => {
    if (!active || downloadingAll) return;
    setDownloadingAll(true);
    setDownloadAllError(null);
    try {
      await downloadAllFormats({
        file: active.file,
        trim,
        quality,
        resize,
        resizeMaxWidth,
        crop: active.crop,
      });
      trackGoal(YM_GOALS.download, {
        download_type: 'all_formats',
        files_count: 1,
        formats: 'optimized,webp,avif',
      });
    } catch (error) {
      setDownloadAllError(
        error instanceof Error ? error.message : 'Не удалось скачать все форматы.',
      );
    } finally {
      setDownloadingAll(false);
    }
  };

  const onDownloadResults = async () => {
    const ready = items.filter((item) => item.results.length > 0);
    if (ready.length === 0 || zippingResults) return;

    setZippingResults(true);
    setDownloadAllError(null);
    try {
      await downloadResultsZip(
        ready.flatMap((item) => {
          const base = item.file.name.replace(/\.[^.]+$/, '') || 'image';
          return item.results.map((result) => ({
            fileName: `${base}.${result.extension}`,
            blob: result.blob,
            extension: result.extension,
          }));
        }),
      );
      const formatsList = [
        ...new Set(ready.flatMap((item) => item.results.map((result) => result.format))),
      ].join(',');
      trackGoal(YM_GOALS.download, {
        download_type: 'queue_zip',
        files_count: ready.length,
        formats: formatsList,
      });
    } catch (error) {
      setDownloadAllError(
        error instanceof Error ? error.message : 'Не удалось собрать ZIP с результатами.',
      );
    } finally {
      setZippingResults(false);
    }
  };

  return {
    downloadingAll,
    zippingResults,
    downloadAllError,
    clearError,
    onDownload,
    onDownloadAll,
    onDownloadResults,
  };
}
