import { useCallback, useEffect, useRef, useState } from 'react';
import { Cropper } from '../components/Cropper';
import { Dropzone } from '../components/Dropzone';
import { OptionsPanel } from '../components/OptionsPanel';
import { ResultPanel } from '../components/ResultPanel';
import { downloadAllFormats } from '../api/optimize';
import { useOptimize } from '../hooks/useOptimize';
import type { CropArea, OptimizeResult, OutputFormat } from '../types';
import { formatBytes } from '../utils/format';
import styles from './HomePage.module.css';

function formatLabel(type: string): string {
  const map: Record<string, string> = {
    'image/png': 'PNG',
    'image/jpeg': 'JPEG',
    'image/webp': 'WEBP',
    'image/avif': 'AVIF',
    'image/gif': 'GIF',
  };
  return map[type] || type.replace('image/', '').toUpperCase() || 'IMAGE';
}

export function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);
  const [format, setFormat] = useState<OutputFormat>('optimized');
  const [trim, setTrim] = useState(false);
  const [resize, setResize] = useState(false);
  const [resizeMaxWidth, setResizeMaxWidth] = useState(1920);
  const [quality, setQuality] = useState(80);
  const [crop, setCrop] = useState<CropArea | undefined>();
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadAllError, setDownloadAllError] = useState<string | null>(null);
  const resultUrlRef = useRef<string | null>(null);

  const optimize = useOptimize();

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  useEffect(() => {
    return () => {
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!imageUrl) {
      setDimensions(null);
      return;
    }
    const img = new Image();
    img.onload = () => setDimensions({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = imageUrl;
  }, [imageUrl]);

  const applyResult = useCallback((next: OptimizeResult) => {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current = next.url;
    setResult(next);
  }, []);

  const runOptimize = useCallback(
    (nextFormat: OutputFormat = format) => {
      if (!file) return;

      optimize.mutate(
        {
          file,
          format: nextFormat,
          trim,
          quality,
          resize,
          resizeMaxWidth,
          crop,
        },
        {
          onSuccess: (data) => {
            applyResult(data);
          },
        },
      );
    },
    [applyResult, crop, file, format, optimize, quality, resize, resizeMaxWidth, trim],
  );

  const onFile = useCallback((next: File) => {
    setFile(next);
    setResult(null);
    setCrop(undefined);
    setFormat('optimized');
    setDownloadAllError(null);
    setImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(next);
    });
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = null;
    }
  }, []);

  const onReset = () => {
    setFile(null);
    setResult(null);
    setCrop(undefined);
    setDownloadAllError(null);
    setImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = null;
    }
    optimize.reset();
  };

  const onFormatChange = (next: OutputFormat) => {
    setFormat(next);
    if (result) {
      runOptimize(next);
    }
  };

  const onDownload = () => {
    if (!result || !file) return;
    const base = file.name.replace(/\.[^.]+$/, '') || 'image';
    const link = document.createElement('a');
    link.href = result.url;
    link.download = `${base}.${result.extension}`;
    link.click();
  };

  const onDownloadAll = async () => {
    if (!file || downloadingAll) return;
    setDownloadingAll(true);
    setDownloadAllError(null);
    try {
      await downloadAllFormats({ file, trim, quality, resize, resizeMaxWidth, crop });
    } catch (error) {
      setDownloadAllError(
        error instanceof Error ? error.message : 'Не удалось скачать все форматы.',
      );
    } finally {
      setDownloadingAll(false);
    }
  };

  return (
    <section className={styles.layout}>
      <div className={styles.workspace}>
        {!file || !imageUrl ? (
          <Dropzone onFile={onFile} />
        ) : (
          <>
            <article className={styles.fileCard}>
              <div className={styles.thumb}>
                <img src={imageUrl} alt="" />
              </div>
              <div className={styles.fileInfo}>
                <div className={styles.fileHeader}>
                  <p className={styles.fileName}>{file.name}</p>
                  <div className={styles.fileActions}>
                    <span className={styles.loadedPill}>ЗАГРУЖЕНО</span>
                    <button type="button" className={styles.reset} onClick={onReset}>
                      Другой файл
                    </button>
                  </div>
                </div>
                <div className={styles.specs}>
                  <div>
                    <span>Исходный размер</span>
                    <strong>{formatBytes(file.size)}</strong>
                  </div>
                  <div>
                    <span>Разрешение</span>
                    <strong>
                      {dimensions ? `${dimensions.w} × ${dimensions.h}` : '…'}
                    </strong>
                  </div>
                  <div>
                    <span>Формат</span>
                    <strong>{formatLabel(file.type)}</strong>
                  </div>
                </div>
              </div>
            </article>

            <div className={styles.block}>
              <div className={styles.blockHead}>
                <h2>Кроп</h2>
                <p>Потяните границы рамки — кроп уйдёт на сервер первым, затем trim.</p>
              </div>
              <Cropper imageUrl={imageUrl} onCropChange={setCrop} />
            </div>

            {result ? (
              <ResultPanel
                result={result}
                busy={optimize.isPending}
                downloadingAll={downloadingAll}
                onFormatChange={onFormatChange}
                onDownload={onDownload}
                onDownloadAll={onDownloadAll}
                fileName={`${file.name.replace(/\.[^.]+$/, '')}.${result.extension}`}
              />
            ) : null}

            {optimize.isError ? (
              <p className={styles.error}>
                {optimize.error.message || 'Не удалось оптимизировать изображение.'}
              </p>
            ) : null}

            {downloadAllError ? <p className={styles.error}>{downloadAllError}</p> : null}
          </>
        )}
      </div>

      <OptionsPanel
        format={format}
        trim={trim}
        resize={resize}
        resizeMaxWidth={resizeMaxWidth}
        quality={quality}
        busy={optimize.isPending}
        disabled={!file}
        onFormatChange={setFormat}
        onTrimChange={setTrim}
        onResizeChange={setResize}
        onResizeMaxWidthChange={setResizeMaxWidth}
        onQualityChange={setQuality}
        onOptimize={() => runOptimize(format)}
      />
    </section>
  );
}
