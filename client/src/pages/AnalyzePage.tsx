import { useMemo, useState, type FormEvent } from 'react';
import {
  ANALYZE_LIMITS,
  analyzePageUrl,
  downloadOptimizedZip,
  fetchAnalyzeImage,
  type AnalyzePageResult,
  type AnalyzedImage,
  type FormatEstimate,
  type FormatEstimates,
} from '../api/analyze';
import { trackGoal, YM_GOALS } from '../analytics/ym';
import { formatBytes } from '../utils/format';
import { setHandoffFiles } from '../utils/imageHandoff';
import styles from './AnalyzePage.module.css';

type Status = 'idle' | 'loading' | 'done' | 'error';
type EstimateKey = keyof FormatEstimates;

const FORMAT_CARDS: {
  key: EstimateKey;
  title: string;
  hint: string;
}[] = [
  {
    key: 'optimized',
    title: 'Исходный формат',
    hint: 'Пережатие JPEG/PNG/WebP без смены формата',
  },
  {
    key: 'webp',
    title: 'WebP',
    hint: 'Универсальный вариант для веба, q80',
  },
  {
    key: 'avif',
    title: 'AVIF',
    hint: 'Обычно самый лёгкий, q80',
  },
];

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function formatLabel(contentType: string, fileName: string): string {
  const fromMime = contentType.replace(/^image\//i, '').toUpperCase();
  if (fromMime && fromMime !== contentType.toUpperCase()) {
    return fromMime === 'JPEG' ? 'JPEG' : fromMime;
  }
  const ext = fileName.split('.').pop()?.toUpperCase();
  if (!ext) return 'IMG';
  if (ext === 'JPG' || ext === 'JPEG') return 'JPEG';
  return ext.slice(0, 5);
}

function pickZipCandidates(images: AnalyzedImage[]): AnalyzedImage[] {
  return images
    .filter((image) => !image.error && image.originalBytes > 0 && image.optimizedBytes > 0)
    .sort((a, b) => b.savedBytes - a.savedBytes || b.originalBytes - a.originalBytes)
    .slice(0, ANALYZE_LIMITS.maxZipImages);
}

export function AnalyzePage({ onNavigate }: { onNavigate: (to: string) => void }) {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzePageResult | null>(null);
  const [zipBusy, setZipBusy] = useState(false);
  const [zipMessage, setZipMessage] = useState<string | null>(null);
  const [openingUrl, setOpeningUrl] = useState<string | null>(null);

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

  const zipCandidates = useMemo(
    () => (result ? pickZipCandidates(result.images) : []),
    [result],
  );

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || status === 'loading') return;

    setStatus('loading');
    setError(null);
    setResult(null);
    setZipMessage(null);
    trackGoal(YM_GOALS.analyzeStart, {
      url_host: (() => {
        try {
          return new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`).hostname;
        } catch {
          return 'invalid';
        }
      })(),
    });

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
      const message =
        err instanceof Error ? err.message : 'Не удалось проанализировать страницу.';
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
        parts.push(`пропущено по лимиту ${formatBytes(ANALYZE_LIMITS.maxZipSourceBytes)}: ${zip.skippedBudget}`);
      }
      setZipMessage(parts.join(' · '));
      trackGoal(YM_GOALS.analyzeZipSuccess, {
        files_count: zip.included,
        fail_count: zip.failed,
        skipped_budget: zip.skippedBudget,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Не удалось скачать архив.';
      setZipMessage(message);
      trackGoal(YM_GOALS.analyzeZipError);
    } finally {
      setZipBusy(false);
    }
  };

  return (
    <section className={styles.page} aria-labelledby="analyze-heading">
      <header className={styles.intro}>
        <h1 id="analyze-heading" className={styles.title}>
          Анализ изображений сайта
        </h1>
        <p className={styles.lead}>
          Вставьте URL любой веб-страницы, и мы проанализируем все изображения на ней — покажем
          их размеры, форматы и сколько трафика можно сэкономить при оптимизации.
        </p>
        <p className={styles.note} role="note">
          Анализируется исходный HTML страницы без выполнения JavaScript. На SPA и сайтах с
          клиентским рендером (React, Vue, Angular и т.п.) картинки могут не найтись или
          результат будет неполным — мы работаем над этим.
        </p>
        <p className={styles.note} role="note">
          Если сайт защищён от автоматических запросов, проанализировать его не получится.
        </p>
      </header>

      <form className={styles.form} onSubmit={(event) => void onSubmit(event)}>
        <label className={styles.srOnly} htmlFor="analyze-url">
          URL веб-сайта
        </label>
        <span className={styles.mobileLabel}>URL веб-сайта</span>
        <div className={styles.row}>
          <input
            id="analyze-url"
            className={styles.input}
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="https://example.com"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            disabled={status === 'loading'}
            required
          />
          <button
            type="submit"
            className={styles.submit}
            disabled={status === 'loading' || !url.trim()}
          >
            {status === 'loading' ? 'Анализ…' : 'Анализ'}
          </button>
        </div>
      </form>

      {status === 'loading' ? (
        <div className={styles.loader} role="status" aria-live="polite">
          <span className={styles.spinner} aria-hidden />
          <div>
            <p className={styles.loaderTitle}>Сканируем страницу</p>
            <p className={styles.loaderHint}>
              Ищем изображения и считаем вес для исходного формата, WebP и AVIF.
            </p>
          </div>
        </div>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}

      {result && status === 'done' ? (
        <div className={styles.results}>
          <div className={styles.resultsHead}>
            <p className={styles.resultsTitle}>
              Результаты анализа: {hostLabel(result.finalUrl)}
            </p>
            <p className={styles.resultsMeta}>Сканирование завершено</p>
          </div>

          <div className={styles.stats}>
            <article className={styles.stat}>
              <span className={styles.statLabel}>Найдено изображений</span>
              <strong className={styles.statValue}>{result.imageCount}</strong>
              <p className={styles.statHint}>
                {result.imageCount === 0 ? (
                  'на этой странице'
                ) : result.truncated ? (
                  <>
                    из‑за ограничений оценили только {ANALYZE_LIMITS.maxAnalyzeImages}
                    <br />
                    сразу оптимизируем {ANALYZE_LIMITS.maxZipImages}
                  </>
                ) : (
                  <>
                    оценили {result.analyzedCount}
                    <br />
                    сразу оптимизируем до {ANALYZE_LIMITS.maxZipImages}
                  </>
                )}
              </p>
            </article>

            <article className={styles.stat}>
              <span className={styles.statLabel}>Вес сейчас</span>
              <strong className={styles.statValue}>{formatBytes(result.totalBytes)}</strong>
              <p className={styles.statHint}>до оптимизации</p>
            </article>

            <article className={`${styles.stat} ${styles.statAccent}`}>
              <span className={styles.statLabel}>Лучший сценарий</span>
              <div className={styles.statValueRow}>
                <strong className={styles.statValue}>
                  −{formatBytes(result.estimates[result.bestFormat].savedBytes)}
                </strong>
                <span className={styles.statPercent}>
                  {result.estimates[result.bestFormat].savedPercent}%
                </span>
              </div>
              <p className={styles.statCompare}>
                <span className={styles.statCompareFrom}>{formatBytes(result.totalBytes)}</span>
                <span className={styles.statCompareArrow} aria-hidden>
                  →
                </span>
                <span className={styles.statCompareTo}>
                  {formatBytes(result.estimates[result.bestFormat].optimizedBytes)}
                </span>
                <span className={styles.statCompareNote}>
                  {result.bestFormat === 'optimized'
                    ? 'исходный формат'
                    : result.bestFormat.toUpperCase()}
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
                  , не больше {formatBytes(ANALYZE_LIMITS.maxZipSourceBytes)} исходников.
                  Сейчас: {zipCandidates.length}.
                </p>
              </div>
              <button
                type="button"
                className={styles.zipButton}
                onClick={() => void onDownloadZip()}
                disabled={zipBusy}
              >
                {zipBusy
                  ? 'Собираем ZIP…'
                  : `Скачать ZIP (${zipCandidates.length})`}
              </button>
            </div>
          ) : null}

          {zipMessage ? (
            <p
              className={
                zipMessage.startsWith('Скачан') ? styles.zipSuccess : styles.error
              }
            >
              {zipMessage}
            </p>
          ) : null}

          {result.images.length > 0 ? (
            <>
              <p className={styles.mobileListTitle}>
                Найденные файлы ({result.images.length}
                {result.imageCount > result.images.length ? ` из ${result.imageCount}` : ''})
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
                  {result.images.map((image) => (
                    <ImageRow
                      key={image.url}
                      image={image}
                      busy={openingUrl === image.url}
                      disabled={Boolean(openingUrl) || Boolean(image.error)}
                      onOptimize={() => void openInTool(image)}
                    />
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <p className={styles.empty}>
              На странице не удалось найти изображения для анализа. Если это SPA или сайт с
              клиентским рендером, картинки появляются только после выполнения JavaScript — сейчас
              мы их не видим. Мы работаем над этим.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

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

function estimateCell(estimate?: FormatEstimate) {
  if (!estimate || estimate.optimizedBytes <= 0) {
    return { size: '—', save: null as string | null };
  }
  return {
    size: formatBytes(estimate.optimizedBytes),
    save: estimate.savedPercent > 0 ? `−${estimate.savedPercent}%` : '0%',
  };
}

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
