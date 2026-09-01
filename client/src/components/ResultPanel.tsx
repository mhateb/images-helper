import type { OptimizeResult, OutputFormat } from '../types';
import { formatBytes, savingsPercent } from '../utils/format';
import styles from './ResultPanel.module.css';

interface ResultPanelProps {
  result: OptimizeResult;
  busy: boolean;
  downloadingAll: boolean;
  onFormatChange: (format: OutputFormat) => void;
  onDownload: () => void;
  onDownloadAll: () => void;
  fileName: string;
}

const FORMATS: OutputFormat[] = ['optimized', 'webp', 'avif'];

export function ResultPanel({
  result,
  busy,
  downloadingAll,
  onFormatChange,
  onDownload,
  onDownloadAll,
  fileName,
}: ResultPanelProps) {
  const saved = savingsPercent(result.originalSize, result.optimizedSize);

  return (
    <section className={styles.root} aria-live="polite">
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
            {downloadingAll ? 'Готовим ZIP…' : 'Скачать все'}
          </button>
          <button type="button" className={styles.download} onClick={onDownload}>
            Скачать
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

      <div className={styles.toggles}>
        <span className={styles.label}>Быстрый формат</span>
        <div className={styles.pills} role="group" aria-label="Сменить формат результата">
          {FORMATS.map((item) => (
            <button
              key={item}
              type="button"
              className={`${styles.pill} ${result.format === item ? styles.active : ''}`}
              onClick={() => onFormatChange(item)}
              disabled={busy || result.format === item}
            >
              {item === 'optimized' ? 'Optimized' : item.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
