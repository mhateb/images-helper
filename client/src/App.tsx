import { lazy, Suspense, useState, type MouseEvent } from 'react';
import type { ConsentStatus } from './analytics/consent';
import { trackGoal, YM_GOALS } from './analytics/ym';
import { BugReportModal } from './components/BugReportModal';
import { ConsentBanner } from './components/ConsentBanner';
import { useDocumentSeo } from './hooks/useDocumentSeo';
import { usePath } from './hooks/usePath';
import { useYandexMetrika } from './hooks/useYandexMetrika';
import { HomePage } from './pages/HomePage';

const GuidePage = lazy(() =>
  import('./pages/GuidePage').then((module) => ({ default: module.GuidePage })),
);
const AnalyzePage = lazy(() =>
  import('./pages/AnalyzePage').then((module) => ({ default: module.AnalyzePage })),
);
const PrivacyPage = lazy(() =>
  import('./pages/PrivacyPage').then((module) => ({ default: module.PrivacyPage })),
);
// import { PicturePage } from './pages/PicturePage';
import styles from './App.module.css';

// type ToolMode = 'single' | 'picture';

export default function App() {
  const { path, navigate } = usePath();
  const isGuide = path === '/guide';
  const isAnalyze = path === '/analyze';
  const isPrivacy = path === '/privacy';
  const isHome = !isGuide && !isAnalyze && !isPrivacy;
  const [bugReportOpen, setBugReportOpen] = useState(false);
  const [consentVersion, setConsentVersion] = useState(0);
  // const [toolMode, setToolMode] = useState<ToolMode>('single');
  useDocumentSeo(path);
  useYandexMetrika(path, consentVersion);

  const onNavClick = (to: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }
    event.preventDefault();
    navigate(to);
  };

  const onConsentChange = (_status: ConsentStatus) => {
    setConsentVersion((value) => value + 1);
  };

  return (
    <>
    <div className={styles.page} inert={bugReportOpen ? true : undefined}>
      <a className={styles.skip} href="#content">
        К содержанию
      </a>
      <header className={styles.header}>
        <a
          href="/"
          className={styles.logo}
          onClick={onNavClick('/')}
          aria-label="Fitpix.ru — на главную"
        >
          <span className={styles.logoIcon} aria-hidden>
            <img src="/icons/crop.svg" alt="" width={16} height={16} />
          </span>
          <span className={styles.logoText}>FITPIX.RU</span>
        </a>

        <nav className={styles.tabs} aria-label="Разделы">
          <a
            href="/"
            className={`${styles.tab} ${isHome ? styles.tabActive : ''}`}
            onClick={onNavClick('/')}
            aria-current={isHome ? 'page' : undefined}
          >
            Инструмент
          </a>
          <a
            href="/guide"
            className={`${styles.tab} ${isGuide ? styles.tabActive : ''}`}
            onClick={onNavClick('/guide')}
            aria-current={isGuide ? 'page' : undefined}
          >
            Гайд
          </a>
          <a
            href="/analyze"
            className={`${styles.tab} ${isAnalyze ? styles.tabActive : ''}`}
            onClick={onNavClick('/analyze')}
            aria-current={isAnalyze ? 'page' : undefined}
          >
            Анализ
          </a>
        </nav>

        <div className={styles.headerRight}>
          <button
            type="button"
            className={styles.bugReport}
            onClick={() => {
              trackGoal(YM_GOALS.bugReportOpen);
              setBugReportOpen(true);
            }}
          >
            Сообщить о проблеме
          </button>
        </div>
      </header>

      {/* {!isGuide ? (
        <div className={styles.modeBar}>
          <div className={styles.modeTabs} role="tablist" aria-label="Режим инструмента">
            <button
              type="button"
              role="tab"
              aria-selected={toolMode === 'single'}
              className={`${styles.modeTab} ${toolMode === 'single' ? styles.modeTabActive : ''}`}
              onClick={() => setToolMode('single')}
            >
              Одна картинка
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={toolMode === 'picture'}
              className={`${styles.modeTab} ${toolMode === 'picture' ? styles.modeTabActive : ''}`}
              onClick={() => setToolMode('picture')}
            >
              Под picture
            </button>
          </div>
        </div>
      ) : null} */}

      <main id="content" tabIndex={-1} className={styles.main}>
        <Suspense fallback={<p className={styles.loading}>Загрузка…</p>}>
          {isPrivacy ? (
            <PrivacyPage onNavigate={navigate} />
          ) : isGuide ? (
            <GuidePage />
          ) : isAnalyze ? (
            <AnalyzePage onNavigate={navigate} />
          ) : (
            // toolMode === 'picture' ? (
            //   <PicturePage />
            // ) : (
            <HomePage />
            // )
          )}
        </Suspense>
      </main>

      <footer className={styles.footer}>
        <a href="/privacy" className={styles.footerLink} onClick={onNavClick('/privacy')}>
          Политика конфиденциальности
        </a>
      </footer>

      <ConsentBanner
        onConsentChange={onConsentChange}
        onOpenPrivacy={() => navigate('/privacy')}
      />
    </div>
    <BugReportModal open={bugReportOpen} onClose={() => setBugReportOpen(false)} />
    </>
  );
}
