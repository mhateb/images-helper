import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Cropper } from '../components/Cropper';
import { Dropzone } from '../components/Dropzone';
import { OptionsPanel } from '../components/OptionsPanel';
import { ResultPanel } from '../components/ResultPanel';
import { downloadAllFormats, downloadResultsZip, optimizeImage } from '../api/optimize';
import type { CropArea, OptimizeResult, OutputFormat } from '../types';
import { formatBytes } from '../utils/format';
import styles from './HomePage.module.css';

const FORMAT_ORDER: OutputFormat[] = ['optimized', 'webp', 'avif'];
const MAX_FILES = 20;

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

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface ImageItem {
  id: string;
  file: File;
  imageUrl: string;
  dimensions: { w: number; h: number } | null;
  crop?: CropArea;
  results: OptimizeResult[];
  error: string | null;
}

function loadDimensions(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error('Не удалось прочитать изображение'));
    img.src = url;
  });
}

function revokeResults(results: OptimizeResult[]) {
  for (const result of results) URL.revokeObjectURL(result.url);
}

function sortFormats(formats: OutputFormat[]): OutputFormat[] {
  return FORMAT_ORDER.filter((format) => formats.includes(format));
}

function pickPreviewFormat(
  results: OptimizeResult[],
  preferred?: OutputFormat | null,
): OutputFormat | null {
  if (results.length === 0) return null;
  if (preferred && results.some((item) => item.format === preferred)) {
    return preferred;
  }
  return results[0].format;
}

export function HomePage() {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [formats, setFormats] = useState<OutputFormat[]>(['optimized']);
  const [previewFormat, setPreviewFormat] = useState<OutputFormat>('optimized');
  const [trim, setTrim] = useState(false);
  const [resize, setResize] = useState(false);
  const [resizeMaxWidth, setResizeMaxWidth] = useState(1920);
  const [quality, setQuality] = useState(80);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [zippingResults, setZippingResults] = useState(false);
  const [downloadAllError, setDownloadAllError] = useState<string | null>(null);
  const [queueNotice, setQueueNotice] = useState<string | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const active = useMemo(
    () => items.find((item) => item.id === activeId) ?? items[0] ?? null,
    [activeId, items],
  );

  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) {
        URL.revokeObjectURL(item.imageUrl);
        revokeResults(item.results);
      }
    };
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<ImageItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const addFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    const remaining = MAX_FILES - itemsRef.current.length;
    if (remaining <= 0) {
      setQueueNotice(`Не больше ${MAX_FILES} файлов за раз. Удалите лишние или очистите очередь.`);
      return;
    }

    const accepted = files.slice(0, remaining);
    if (accepted.length < files.length) {
      setQueueNotice(
        `Добавлено ${accepted.length} из ${files.length}: лимит ${MAX_FILES} файлов за раз.`,
      );
    } else {
      setQueueNotice(null);
    }

    const created: ImageItem[] = accepted.map((file) => ({
      id: createId(),
      file,
      imageUrl: URL.createObjectURL(file),
      dimensions: null,
      crop: undefined,
      results: [],
      error: null,
    }));

    setItems((prev) => [...prev, ...created]);
    setActiveId((prev) => prev ?? created[0].id);

    for (const item of created) {
      try {
        const dimensions = await loadDimensions(item.imageUrl);
        updateItem(item.id, { dimensions });
      } catch {
        updateItem(item.id, { error: 'Не удалось прочитать изображение.' });
      }
    }
  }, [updateItem]);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.imageUrl);
        revokeResults(target.results);
      }
      const next = prev.filter((item) => item.id !== id);
      setActiveId((current) => {
        if (current !== id) return current;
        return next[0]?.id ?? null;
      });
      return next;
    });
    setDownloadAllError(null);
    setQueueNotice(null);
  }, []);

  const onReset = () => {
    setItems((prev) => {
      for (const item of prev) {
        URL.revokeObjectURL(item.imageUrl);
        revokeResults(item.results);
      }
      return [];
    });
    setActiveId(null);
    setDownloadAllError(null);
    setQueueNotice(null);
    setProgress(null);
  };

  const runOptimize = useCallback(
    async (nextFormats: OutputFormat[] = formats, onlyId?: string) => {
      const selected = sortFormats(nextFormats);
      if (selected.length === 0) return;

      const targets = onlyId
        ? items.filter((item) => item.id === onlyId)
        : items;
      if (targets.length === 0 || busy) return;

      setBusy(true);
      const total = targets.length * selected.length;
      setProgress({ done: 0, total });
      setDownloadAllError(null);
      setFormats(selected);
      setPreviewFormat(selected[0]);

      let done = 0;
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
          } catch (error) {
            lastError =
              error instanceof Error
                ? error.message
                : 'Не удалось оптимизировать изображение.';
          }

          done += 1;
          setProgress({ done, total });
        }

        setItems((prev) =>
          prev.map((entry) => {
            if (entry.id !== item.id) return entry;
            revokeResults(entry.results);
            return {
              ...entry,
              results: nextResults,
              error: nextResults.length > 0 ? null : lastError,
            };
          }),
        );
      }

      setBusy(false);
      setProgress(null);
    },
    [busy, formats, items, quality, resize, resizeMaxWidth, trim],
  );

  const onDownload = async () => {
    if (!active || active.results.length === 0) return;
    const base = active.file.name.replace(/\.[^.]+$/, '') || 'image';

    if (active.results.length === 1) {
      const result = active.results[0];
      const link = document.createElement('a');
      link.href = result.url;
      link.download = `${base}.${result.extension}`;
      link.click();
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
    } catch (error) {
      setDownloadAllError(
        error instanceof Error ? error.message : 'Не удалось собрать ZIP.',
      );
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
    } catch (error) {
      setDownloadAllError(
        error instanceof Error ? error.message : 'Не удалось собрать ZIP с результатами.',
      );
    } finally {
      setZippingResults(false);
    }
  };

  const readyCount = items.filter((item) => item.results.length > 0).length;
  const activePreviewFormat = active
    ? pickPreviewFormat(active.results, previewFormat)
    : null;
  const activePreview = active?.results.find(
    (item) => item.format === activePreviewFormat,
  );

  return (
    <section className={styles.layout} aria-labelledby="home-heading">
      <div className={styles.workspace}>
        <header className={styles.intro}>
          <h1 id="home-heading" className={styles.title}>
            Онлайн-оптимизация картинок
          </h1>
          <p className={styles.lead}>
            Сжатие JPEG/PNG, WebP и AVIF, авто-trim и ручной кроп — бесплатно, без
            регистрации.
          </p>
        </header>

        {items.length === 0 ? (
          <Dropzone
            onFiles={addFiles}
            hint={`До ${MAX_FILES} файлов за раз. PNG, JPEG, WEBP, AVIF, GIF до 30 МБ каждый`}
          />
        ) : active ? (
          <>
            <div className={styles.queue}>
              <div className={styles.queueList} role="list" aria-label="Загруженные изображения">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="listitem"
                    className={`${styles.queueItem} ${item.id === active.id ? styles.queueItemActive : ''}`}
                    onClick={() => setActiveId(item.id)}
                    title={item.file.name}
                  >
                    <img src={item.imageUrl} alt="" />
                    {item.results.length > 0 ? (
                      <span className={styles.queueDone} aria-hidden />
                    ) : null}
                    {item.error ? <span className={styles.queueFail} aria-hidden /> : null}
                  </button>
                ))}
                <button
                  type="button"
                  className={styles.queueAdd}
                  onClick={() => addInputRef.current?.click()}
                  aria-label="Добавить изображения"
                  disabled={items.length >= MAX_FILES}
                  title={
                    items.length >= MAX_FILES
                      ? `Не больше ${MAX_FILES} файлов за раз`
                      : 'Добавить изображения'
                  }
                >
                  +
                </button>
                <input
                  ref={addInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                  multiple
                  className={styles.hiddenInput}
                  onChange={(e) => {
                    void addFiles(Array.from(e.target.files ?? []));
                    e.target.value = '';
                  }}
                />
              </div>
              <div className={styles.queueMeta}>
                <span>
                  {items.length}/{MAX_FILES}{' '}
                  {items.length === 1 ? 'файл' : items.length < 5 ? 'файла' : 'файлов'}
                </span>
                <button type="button" className={styles.queueAction} onClick={onReset}>
                  Очистить
                </button>
              </div>
              {queueNotice ? <p className={styles.queueNotice}>{queueNotice}</p> : null}
            </div>

            <article className={styles.fileCard}>
              <div className={styles.thumb}>
                <img src={active.imageUrl} alt="" />
              </div>
              <div className={styles.fileInfo}>
                <div className={styles.fileHeader}>
                  <p className={styles.fileName}>{active.file.name}</p>
                  <div className={styles.fileActions}>
                    <span className={styles.loadedPill}>
                      {active.results.length > 0 ? 'ГОТОВО' : 'ЗАГРУЖЕНО'}
                    </span>
                    {items.length > 1 ? (
                      <button
                        type="button"
                        className={styles.reset}
                        onClick={() => removeItem(active.id)}
                      >
                        Удалить
                      </button>
                    ) : (
                      <button type="button" className={styles.reset} onClick={onReset}>
                        Другой файл
                      </button>
                    )}
                  </div>
                </div>
                <div className={styles.specs}>
                  <div>
                    <span>Исходный размер</span>
                    <strong>{formatBytes(active.file.size)}</strong>
                  </div>
                  <div>
                    <span>Разрешение</span>
                    <strong>
                      {active.dimensions
                        ? `${active.dimensions.w} × ${active.dimensions.h}`
                        : '…'}
                    </strong>
                  </div>
                  <div>
                    <span>Формат</span>
                    <strong>{formatLabel(active.file.type)}</strong>
                  </div>
                </div>
              </div>
            </article>

            <div className={styles.block}>
              <div className={styles.blockHead}>
                <h2>Кроп</h2>
                <p>
                  Потяните границы рамки — кроп уйдёт на сервер первым, затем trim.
                  {items.length > 1 ? ' Для каждой картинки свой кроп.' : ''}
                </p>
              </div>
              <Cropper
                key={active.id}
                imageUrl={active.imageUrl}
                initialCrop={active.crop}
                onCropChange={(crop) => updateItem(active.id, { crop })}
              />
            </div>

            {active.results.length > 0 && activePreview ? (
              <ResultPanel
                results={active.results}
                activeFormat={activePreview.format}
                busy={busy}
                downloadingAll={downloadingAll}
                onActiveFormatChange={setPreviewFormat}
                onDownload={() => void onDownload()}
                onDownloadAll={() => void onDownloadAll()}
                fileName={`${active.file.name.replace(/\.[^.]+$/, '')}.${activePreview.extension}`}
                readyCount={readyCount}
                zippingResults={zippingResults}
                onDownloadResults={() => void onDownloadResults()}
              />
            ) : null}

            {active.error ? <p className={styles.error}>{active.error}</p> : null}

            {downloadAllError ? <p className={styles.error}>{downloadAllError}</p> : null}
          </>
        ) : null}
      </div>

      <OptionsPanel
        formats={formats}
        trim={trim}
        resize={resize}
        resizeMaxWidth={resizeMaxWidth}
        quality={quality}
        busy={busy}
        disabled={items.length === 0}
        fileCount={items.length}
        progress={progress}
        onFormatsChange={setFormats}
        onTrimChange={setTrim}
        onResizeChange={setResize}
        onResizeMaxWidthChange={setResizeMaxWidth}
        onQualityChange={setQuality}
        onOptimize={() => void runOptimize(formats)}
      />
    </section>
  );
}
