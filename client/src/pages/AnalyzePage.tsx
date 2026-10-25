import { useMemo, useState, type FormEvent } from 'react';
import {
  ANALYZE_LIMITS,
  analyzePageUrl,
  downloadOptimizedZip,
  type AnalyzePageResult,
  type AnalyzedImage,
} from '../api/analyze';
import { trackGoal, YM_GOALS } from '../analytics/ym';
import { formatBytes } from '../utils/format';
import styles from './AnalyzePage.module.css';

type Status = 'idle' | 'loading' | 'done' | 'error';

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

export function AnalyzePage() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzePageResult | null>(null);
  const [zipBusy, setZipBusy] = useState(false);
  const [zipMessage, setZipMessage] = useState<string | null>(null);

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
              Ищем изображения и оцениваем потенциал сжатия. Обычно это занимает несколько секунд.
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
                {result.analyzedCount > 0
                  ? `оценено ${result.analyzedCount}`
                  : 'на этой странице'}
              </p>
            </article>

            <article className={styles.stat}>
              <span className={styles.statLabel}>Вес сейчас</span>
              <strong className={styles.statValue}>{formatBytes(result.totalBytes)}</strong>
              <p className={styles.statHint}>до оптимизации</p>
            </article>

            <article className={`${styles.stat} ${styles.statAccent}`}>
              <span className={styles.statLabel}>Можно сэкономить</span>
              <div className={styles.statValueRow}>
                <strong className={styles.statValue}>
                  −{formatBytes(result.savedBytes)}
                </strong>
                <span className={styles.statPercent}>{result.savedPercent}%</span>
              </div>
              <p className={styles.statCompare}>
                <span className={styles.statCompareFrom}>{formatBytes(result.totalBytes)}</span>
                <span className={styles.statCompareArrow} aria-hidden>
                  →
                </span>
                <span className={styles.statCompareTo}>{formatBytes(result.optimizedBytes)}</span>
                <span className={styles.statCompareNote}>после WebP</span>
              </p>
            </article>
          </div>

          {zipCandidates.length > 0 ? (
            <div className={styles.zipBar}>
              <div className={styles.zipCopy}>
                <p className={styles.zipTitle}>Скачать оптимизированные WebP</p>
                <p className={styles.zipHint}>
                  В архив попадёт до {ANALYZE_LIMITS.maxZipImages} картинок с наибольшей экономией
                  {result.analyzedCount > ANALYZE_LIMITS.maxZipImages
                    ? ` (из ${result.analyzedCount} оценённых)`
                    : ''}
                  , суммарно не больше {formatBytes(ANALYZE_LIMITS.maxZipSourceBytes)} исходников.
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
                  <span className={styles.colSize}>Текущий размер</span>
                  <span className={styles.colSize}>Оптимальный размер</span>
                  <span className={styles.colSave}>Сжатие</span>
                  <span className={styles.colAction} />
                </div>
                <ul className={styles.list}>
                  {result.images.map((image) => (
                    <ImageRow key={image.url} image={image} />
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <p className={styles.empty}>На странице не удалось найти изображения для анализа.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function ImageRow({ image }: { image: AnalyzedImage }) {
  const format = formatLabel(image.contentType, image.fileName);

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
          <span className={styles.mobileOpt}>
            {image.optimizedBytes > 0 ? formatBytes(image.optimizedBytes) : '—'}
          </span>
        </div>
      </div>

      <div className={`${styles.metric} ${styles.metricMuted}`}>
        {image.originalBytes > 0 ? formatBytes(image.originalBytes) : '—'}
      </div>
      <div className={`${styles.metric} ${styles.metricStrong}`}>
        {image.optimizedBytes > 0 ? formatBytes(image.optimizedBytes) : '—'}
      </div>
      <div className={styles.savingCell}>
        {image.savedPercent > 0 ? (
          <span className={styles.savingPill}>−{image.savedPercent}%</span>
        ) : (
          <span className={styles.metric}>—</span>
        )}
      </div>
      <div className={styles.action}>
        <a className={styles.optimizeLink} href="/" title="Открыть инструмент">
          Оптимизировать
        </a>
      </div>
    </li>
  );
}
