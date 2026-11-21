import { Dropzone } from '../components/Dropzone';
import { OptionsPanel } from '../components/OptionsPanel';
import { ResultPanel } from '../components/ResultPanel';
import { useImageOptimize } from '../hooks/useImageOptimize';
import { useImageQueue } from '../hooks/useImageQueue';
import { useResultDownloads } from '../hooks/useResultDownloads';
import { ActiveFileCard } from './home/ActiveFileCard';
import { CropBlock } from './home/CropBlock';
import { pickPreviewFormat } from './home/imageItem';
import { ImageQueue } from './home/ImageQueue';
import styles from './HomePage.module.css';

export function HomePage() {
  const queue = useImageQueue();
  const naturalWidth = queue.active?.dimensions?.w;
  const originalWidth = naturalWidth != null && naturalWidth > 0 ? naturalWidth : null;
  const optimize = useImageOptimize(
    queue.items,
    queue.active?.id ?? null,
    originalWidth,
    queue.replaceResults,
  );
  const downloads = useResultDownloads({
    active: queue.active,
    items: queue.items,
    trim: optimize.trim,
    quality: optimize.quality,
    resize: optimize.resize,
    resizeMaxWidth: optimize.resizeMaxWidth,
  });

  const onReset = () => {
    queue.reset();
    downloads.clearError();
    optimize.clearProgress();
  };

  const onRemove = (id: string) => {
    queue.removeItem(id);
    downloads.clearError();
  };

  const active = queue.active;
  const readyCount = queue.items.filter((item) => item.results.length > 0).length;
  const activePreviewFormat = active
    ? pickPreviewFormat(active.results, optimize.previewFormat)
    : null;
  const activePreview = active?.results.find((item) => item.format === activePreviewFormat);

  return (
    <section className={styles.layout} aria-labelledby="home-heading">
      <div className={styles.workspace}>
        <header className={styles.intro}>
          <h1 id="home-heading" className={styles.title}>
            Онлайн-оптимизация картинок
          </h1>
          <p className={styles.lead}>
            Сжатие JPEG и PNG, конвертация в WebP и AVIF, обрезка.
          </p>
        </header>

        {queue.items.length === 0 ? (
          <Dropzone
            onFiles={queue.addFiles}
          />
        ) : active ? (
          <>
            <ImageQueue
              items={queue.items}
              activeId={active.id}
              notice={queue.queueNotice}
              onSelect={queue.setActiveId}
              onAdd={(files) => void queue.addFiles(files)}
              onReset={onReset}
            />

            <ActiveFileCard
              item={active}
              canRemove={queue.items.length > 1}
              onRemove={() => onRemove(active.id)}
              onReset={onReset}
            />

            <CropBlock
              item={active}
              multiple={queue.items.length > 1}
              onCropChange={(crop) => queue.updateItem(active.id, { crop })}
            />

            {active.results.length > 0 && activePreview ? (
              <ResultPanel
                results={active.results}
                activeFormat={activePreview.format}
                busy={optimize.busy}
                downloadingAll={downloads.downloadingAll}
                onActiveFormatChange={optimize.setPreviewFormat}
                onDownload={() => void downloads.onDownload()}
                onDownloadAll={() => void downloads.onDownloadAll()}
                fileName={`${active.file.name.replace(/\.[^.]+$/, '')}.${activePreview.extension}`}
                readyCount={readyCount}
                zippingResults={downloads.zippingResults}
                onDownloadResults={() => void downloads.onDownloadResults()}
              />
            ) : null}

            {active.error ? <p className={styles.error}>{active.error}</p> : null}
            {downloads.downloadAllError ? (
              <p className={styles.error}>{downloads.downloadAllError}</p>
            ) : null}
          </>
        ) : null}
      </div>

      <OptionsPanel
        formats={optimize.formats}
        trim={optimize.trim}
        resize={optimize.resize}
        resizeMaxWidth={optimize.resizeMaxWidth}
        quality={optimize.quality}
        busy={optimize.busy}
        disabled={queue.items.length === 0}
        fileCount={queue.items.length}
        progress={optimize.progress}
        onFormatsChange={optimize.setFormats}
        onTrimChange={optimize.setTrim}
        onResizeChange={optimize.setResize}
        onResizeMaxWidthChange={optimize.setResizeMaxWidth}
        originalWidth={originalWidth ?? undefined}
        onQualityChange={optimize.setQuality}
        onOptimize={() => {
          downloads.clearError();
          void optimize.runOptimize(optimize.formats);
        }}
      />
    </section>
  );
}
