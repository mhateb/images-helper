import {
  ANALYZE_LIMITS,
  type AnalyzedImage,
  type AnalyzePageResult,
  type FormatEstimate,
} from '../../api/analyze';
import { formatBytes } from '../../utils/format';
import styles from '../AnalyzePage.module.css';
import { FORMAT_CARDS, hostLabel } from './labels';

function FormatCard({
  title,
  hint,
  totalBytes,
  estimate,
  best,
}: {
  title: string;
  hint: string;
  totalBytes: number;
  estimate: FormatEstimate;
  best: boolean;
}) {
  return (
    <article className={`${styles.formatCard} ${best ? styles.formatCardBest : ''}`}>
      <div className={styles.formatCardTop}>
        <span className={styles.formatCardTitle}>{title}</span>
        {best ? <span className={styles.bestBadge}>лучше</span> : null}
      </div>
      <strong className={styles.formatCardValue}>{formatBytes(estimate.optimizedBytes)}</strong>
      <p className={styles.formatCardDiff}>
        {totalBytes > 0 ? (
          <>
            {formatBytes(totalBytes)} → {formatBytes(estimate.optimizedBytes)}
          </>
        ) : (
          '—'
        )}
      </p>
      <p className={styles.formatCardSave}>
        {estimate.savedBytes > 0
          ? `−${formatBytes(estimate.savedBytes)} (${estimate.savedPercent}%)`
          : 'без выигрыша'}
      </p>
      <p className={styles.formatCardHint}>{hint}</p>
    </article>
  );
}

function foundHint(result: AnalyzePageResult) {
  if (result.imageCount === 0) return 'на этой странице';
  if (result.truncated) {
    return (
      <>
        из‑за ограничений оценили только {ANALYZE_LIMITS.maxAnalyzeImages}
        <br />
        сразу оптимизируем {ANALYZE_LIMITS.maxZipImages}
      </>
    );
  }
  return (
    <>
      оценили {result.analyzedCount}
      <br />
      сразу оптимизируем до {ANALYZE_LIMITS.maxZipImages}
    </>
  );
}

export function AnalyzeSummary({
  result,
  zipCandidates,
  zipBusy,
  zipMessage,
  onDownloadZip,
}: {
  result: AnalyzePageResult;
  zipCandidates: AnalyzedImage[];
  zipBusy: boolean;
  zipMessage: string | null;
  onDownloadZip: () => void;
}) {
  const best = result.estimates[result.bestFormat];

  return (
    <>
      <div className={styles.resultsHead}>
        <p className={styles.resultsTitle}>Результаты анализа: {hostLabel(result.finalUrl)}</p>
        <p className={styles.resultsMeta}>Сканирование завершено</p>
      </div>

      <div className={styles.stats}>
        <article className={styles.stat}>
          <span className={styles.statLabel}>Найдено изображений</span>
          <strong className={styles.statValue}>{result.imageCount}</strong>
          <p className={styles.statHint}>{foundHint(result)}</p>
        </article>

        <article className={styles.stat}>
          <span className={styles.statLabel}>Вес сейчас</span>
          <strong className={styles.statValue}>{formatBytes(result.totalBytes)}</strong>
          <p className={styles.statHint}>до оптимизации</p>
        </article>

        <article className={`${styles.stat} ${styles.statAccent}`}>
          <span className={styles.statLabel}>Лучший сценарий</span>
          <div className={styles.statValueRow}>
            <strong className={styles.statValue}>−{formatBytes(best.savedBytes)}</strong>
            <span className={styles.statPercent}>{best.savedPercent}%</span>
          </div>
          <p className={styles.statCompare}>
            <span className={styles.statCompareFrom}>{formatBytes(result.totalBytes)}</span>
            <span className={styles.statCompareArrow} aria-hidden>
              →
            </span>
            <span className={styles.statCompareTo}>{formatBytes(best.optimizedBytes)}</span>
            <span className={styles.statCompareNote}>
              {result.bestFormat === 'optimized' ? 'исходный формат' : result.bestFormat.toUpperCase()}
            </span>
          </p>
        </article>
      </div>

      <section className={styles.formatSection} aria-label="Сценарии оптимизации">
        <div className={styles.formatSectionHead}>
          <h2 className={styles.formatSectionTitle}>Сколько станет в разных форматах</h2>
          <p className={styles.formatSectionHint}>Оценка при quality 80, без ресайза</p>
        </div>
        <div className={styles.formatGrid}>
          {FORMAT_CARDS.map((card) => (
            <FormatCard
              key={card.key}
              title={card.title}
              hint={card.hint}
              totalBytes={result.totalBytes}
              estimate={result.estimates[card.key]}
              best={result.bestFormat === card.key}
            />
          ))}
        </div>
      </section>

      {zipCandidates.length > 0 ? (
        <div className={styles.zipBar}>
          <div className={styles.zipCopy}>
            <p className={styles.zipTitle}>Скачать оптимизированные WebP</p>
            <p className={styles.zipHint}>
              Архив в WebP: до {ANALYZE_LIMITS.maxZipImages} картинок с наибольшей экономией
              {result.analyzedCount > ANALYZE_LIMITS.maxZipImages
                ? ` (из ${result.analyzedCount} оценённых)`
                : ''}
              , не больше {formatBytes(ANALYZE_LIMITS.maxZipSourceBytes)} исходников. Сейчас:{' '}
              {zipCandidates.length}.
            </p>
          </div>
          <button
            type="button"
            className={styles.zipButton}
            onClick={onDownloadZip}
            disabled={zipBusy}
          >
            {zipBusy ? 'Собираем ZIP…' : `Скачать ZIP (${zipCandidates.length})`}
          </button>
        </div>
      ) : null}

      {zipMessage ? (
        <p className={zipMessage.startsWith('Скачан') ? styles.zipSuccess : styles.error}>
          {zipMessage}
        </p>
      ) : null}
    </>
  );
}
