import type { OptimizeResult, OutputFormat } from '../types';
import { formatBytes, savingsPercent } from '../utils/format';
import styles from './ResultPanel.module.css';

interface ResultPanelProps {
  results: OptimizeResult[];
  activeFormat: OutputFormat;
  busy: boolean;
  downloadingAll: boolean;
  onActiveFormatChange: (format: OutputFormat) => void;
  onDownload: () => void;
  onDownloadAll: () => void;
  fileName: string;
  readyCount?: number;
  zippingResults?: boolean;
  onDownloadResults?: () => void;
}

const FORMAT_ORDER: OutputFormat[] = ['optimized', 'webp', 'avif'];

function formatTitle(format: OutputFormat): string {
  return format === 'optimized' ? 'Optimized' : format.toUpperCase();
}

export function ResultPanel({
  results,
  activeFormat,
  busy,
  downloadingAll,
  onActiveFormatChange,
  onDownload,
  onDownloadAll,
  fileName,
  readyCount = 1,
  zippingResults = false,
  onDownloadResults,
}: ResultPanelProps) {
  const result =
    results.find((item) => item.format === activeFormat) ?? results[0] ?? null;
  if (!result) return null;

  const saved = savingsPercent(result.originalSize, result.optimizedSize);
  const showBatchZip = readyCount > 1 && onDownloadResults;
  const availableFormats = FORMAT_ORDER.filter((format) =>
    results.some((item) => item.format === format),
  );
  const downloadLabel =
    results.length > 1 ? `Скачать (${results.length})` : 'Скачать';

  return (
    <section className={styles.root} aria-live="polite">
      {showBatchZip ? (
        <div className={styles.batchBar}>
          <div className={styles.batchText}>
            <strong>Готово {readyCount} файлов</strong>
            <span>Скачать все результаты одним ZIP-архивом</span>
          </div>
          <button
            type="button"
            className={styles.batchDownload}
            onClick={onDownloadResults}
            disabled={busy || zippingResults}
          >
            {zippingResults ? 'Собираем ZIP…' : 'Скачать ZIP'}
          </button>
        </div>
      ) : null}

      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Результат</p>
          <h2>{fileName}</h2>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.downloadAll}
            onClick={onDownloadAll}
            disabled={busy || downloadingAll}
          >
            {downloadingAll ? 'Готовим ZIP…' : 'Все форматы'}
          </button>
          <button type="button" className={styles.download} onClick={onDownload}>
            {downloadLabel}
          </button>
        </div>
      </header>

      <div className={styles.previewWrap}>
        <img
          key={result.url}
          src={result.url}
          alt="Оптимизированное изображение"
          className={styles.preview}
        />
      </div>

      <div className={styles.stats}>
        <div>
          <span>Вес было</span>
          <strong>{formatBytes(result.originalSize)}</strong>
        </div>
        <div>
          <span>Вес стало</span>
          <strong>{formatBytes(result.optimizedSize)}</strong>
        </div>
        <div>
          <span>Экономия</span>
          <strong className={saved >= 0 ? styles.good : styles.bad}>
            {saved > 0 ? `−${saved}%` : saved < 0 ? `+${Math.abs(saved)}%` : '0%'}
          </strong>
        </div>
        <div>
          <span>Разрешение</span>
          <strong className={styles.resolution}>
            {result.originalWidth > 0 && result.originalHeight > 0 ? (
              <>
                <span>
                  {result.originalWidth}×{result.originalHeight}
                </span>
                <span className={styles.arrow} aria-hidden>
                  →
                </span>
                <span>
                  {result.width}×{result.height}
                </span>
              </>
            ) : (
              <span>
                {result.width}×{result.height}
              </span>
            )}
          </strong>
        </div>
      </div>

      {availableFormats.length > 1 ? (
        <div className={styles.toggles}>
          <span className={styles.label}>Формат превью</span>
          <div className={styles.pills} role="group" aria-label="Сменить формат результата">
            {availableFormats.map((item) => (
              <button
                key={item}
                type="button"
                className={`${styles.pill} ${result.format === item ? styles.active : ''}`}
                onClick={() => onActiveFormatChange(item)}
                disabled={busy || result.format === item}
              >
                {formatTitle(item)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
