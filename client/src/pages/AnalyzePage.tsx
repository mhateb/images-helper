import { useAnalyzePage } from '../hooks/useAnalyzePage';
import { AnalyzeForm } from './analyze/AnalyzeForm';
import { AnalyzedImageList } from './analyze/AnalyzedImageList';
import { AnalyzeSummary } from './analyze/AnalyzeSummary';
import styles from './AnalyzePage.module.css';

export function AnalyzePage({ onNavigate }: { onNavigate: (to: string) => void }) {
  const analyze = useAnalyzePage(onNavigate);

  return (
    <section className={styles.page} aria-labelledby="analyze-heading">
      <header className={styles.intro}>
        <h1 id="analyze-heading" className={styles.title}>
          Анализ изображений сайта
        </h1>
        <p className={styles.lead}>
          Вставьте URL страницы. Мы найдём на ней картинки, покажем их вес и форматы и посчитаем,
          сколько можно сэкономить.
        </p>
        <p className={styles.note} role="note">
          Мы читаем только исходный HTML и не запускаем JavaScript. Если картинки на сайте
          появляются после загрузки (React, Vue, Angular), мы их не найдём или найдём не все.
          Сайты с защитой от ботов тоже не откроются.
        </p>
      </header>

      <AnalyzeForm
        url={analyze.url}
        loading={analyze.status === 'loading'}
        onUrlChange={analyze.setUrl}
        onSubmit={analyze.onSubmit}
      />

      {analyze.status === 'loading' ? (
        <div className={styles.loader} role="status" aria-live="polite">
          <span className={styles.spinner} aria-hidden />
          <div>
            <p className={styles.loaderTitle}>Сканируем страницу</p>
            <p className={styles.loaderHint}>
              Ищем картинки и считаем вес в исходном формате, WebP и AVIF.
            </p>
          </div>
        </div>
      ) : null}

      {analyze.error ? <p className={styles.error}>{analyze.error}</p> : null}

      {analyze.result && analyze.status === 'done' ? (
        <div className={styles.results}>
          <AnalyzeSummary
            result={analyze.result}
            zipCandidates={analyze.zipCandidates}
            zipBusy={analyze.zipBusy}
            zipMessage={analyze.zipMessage}
            onDownloadZip={() => void analyze.onDownloadZip()}
          />
          <AnalyzedImageList
            images={analyze.result.images}
            imageCount={analyze.result.imageCount}
            openingUrl={analyze.openingUrl}
            onOptimize={(image) => void analyze.openInTool(image)}
          />
        </div>
      ) : null}
    </section>
  );
}
