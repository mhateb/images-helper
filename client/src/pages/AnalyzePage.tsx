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
              Ищем изображения и считаем вес для исходного формата, WebP и AVIF.
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
