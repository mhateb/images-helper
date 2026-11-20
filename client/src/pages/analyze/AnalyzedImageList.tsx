import type { AnalyzedImage } from '../../api/analyze';
import { formatBytes } from '../../utils/format';
import { estimateCell, formatLabel } from './labels';
import styles from '../AnalyzePage.module.css';

function ImageRow({
  image,
  busy,
  disabled,
  onOptimize,
}: {
  image: AnalyzedImage;
  busy: boolean;
  disabled: boolean;
  onOptimize: () => void;
}) {
  const format = formatLabel(image.contentType, image.fileName);
  const same = estimateCell(image.estimates?.optimized);
  const webp = estimateCell(image.estimates?.webp);
  const avif = estimateCell(image.estimates?.avif);

  return (
    <li className={styles.rowItem}>
      <div className={styles.thumb}>
        {image.thumbnailDataUrl ? (
          <img src={image.thumbnailDataUrl} alt="" />
        ) : (
          <span className={styles.thumbFallback} aria-hidden />
        )}
      </div>

      <div className={styles.fileInfo}>
        <div className={styles.fileLine}>
          <a
            className={styles.fileName}
            href={image.url}
            target="_blank"
            rel="noreferrer"
            title={image.url}
          >
            {image.fileName}
          </a>
          <span className={styles.formatTag}>{format}</span>
        </div>
        {image.error ? <span className={styles.rowError}>{image.error}</span> : null}
        <div className={styles.mobileSizes}>
          <span>{image.originalBytes > 0 ? formatBytes(image.originalBytes) : '—'}</span>
          <span className={styles.mobileArrow} aria-hidden>
            →
          </span>
          <span className={styles.mobileOpt}>{webp.size}</span>
          <span className={styles.mobileFormats}>
            исх. {same.save ?? '—'} · WebP {webp.save ?? '—'} · AVIF {avif.save ?? '—'}
          </span>
        </div>
      </div>

      <div className={`${styles.metric} ${styles.metricMuted}`}>
        {image.originalBytes > 0 ? formatBytes(image.originalBytes) : '—'}
      </div>
      <div className={styles.metricStack}>
        <span className={styles.metricStrong}>{same.size}</span>
        {same.save ? <span className={styles.savingPill}>{same.save}</span> : null}
      </div>
      <div className={styles.metricStack}>
        <span className={styles.metricStrong}>{webp.size}</span>
        {webp.save ? <span className={styles.savingPill}>{webp.save}</span> : null}
      </div>
      <div className={styles.metricStack}>
        <span className={styles.metricStrong}>{avif.size}</span>
        {avif.save ? <span className={styles.savingPill}>{avif.save}</span> : null}
      </div>
      <div className={styles.action}>
        <button
          type="button"
          className={styles.optimizeLink}
          onClick={onOptimize}
          disabled={disabled}
          title="Открыть в инструменте с этой картинкой"
        >
          {busy ? 'Загрузка…' : 'Оптимизировать'}
        </button>
      </div>
    </li>
  );
}

export function AnalyzedImageList({
  images,
  imageCount,
  openingUrl,
  onOptimize,
}: {
  images: AnalyzedImage[];
  imageCount: number;
  openingUrl: string | null;
  onOptimize: (image: AnalyzedImage) => void;
}) {
  if (images.length === 0) {
    return (
      <p className={styles.empty}>
        На странице не удалось найти изображения для анализа. Если это SPA или сайт с клиентским
        рендером, картинки появляются только после выполнения JavaScript — сейчас мы их не видим.
        Мы работаем над этим.
      </p>
    );
  }

  return (
    <>
      <p className={styles.mobileListTitle}>
        Найденные файлы ({images.length}
        {imageCount > images.length ? ` из ${imageCount}` : ''})
      </p>
      <div className={styles.tableWrap}>
        <div className={styles.tableHead} aria-hidden>
          <span className={styles.colThumb} />
          <span className={styles.colName}>Имя файла</span>
          <span className={styles.colSize}>Сейчас</span>
          <span className={styles.colSize}>Исходный</span>
          <span className={styles.colSize}>WebP</span>
          <span className={styles.colSize}>AVIF</span>
          <span className={styles.colAction} />
        </div>
        <ul className={styles.list}>
          {images.map((image) => (
            <ImageRow
              key={image.url}
              image={image}
              busy={openingUrl === image.url}
              disabled={Boolean(openingUrl) || Boolean(image.error)}
              onOptimize={() => onOptimize(image)}
            />
          ))}
        </ul>
      </div>
    </>
  );
}
