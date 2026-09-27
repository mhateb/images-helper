import { useState, type MouseEvent } from 'react';
import type { ConsentStatus } from './analytics/consent';
import { trackGoal, YM_GOALS } from './analytics/ym';
import { BugReportModal } from './components/BugReportModal';
import { ConsentBanner } from './components/ConsentBanner';
import { useDocumentSeo } from './hooks/useDocumentSeo';
import { usePath } from './hooks/usePath';
import { useYandexMetrika } from './hooks/useYandexMetrika';
import { GuidePage } from './pages/GuidePage';
import { HomePage } from './pages/HomePage';
import { PrivacyPage } from './pages/PrivacyPage';
// import { PicturePage } from './pages/PicturePage';
import styles from './App.module.css';

// type ToolMode = 'single' | 'picture';

export default function App() {
  const { path, navigate } = usePath();
  const isGuide = path === '/guide';
  const isPrivacy = path === '/privacy';
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
    <div className={styles.page}>
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
            className={`${styles.tab} ${!isGuide && !isPrivacy ? styles.tabActive : ''}`}
            onClick={onNavClick('/')}
            aria-current={!isGuide && !isPrivacy ? 'page' : undefined}
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
            Багрепорт
          </button>
          <div className={styles.status}>
            <span className={styles.statusDot} aria-hidden />
            <span className={styles.statusText}>v1.2.0 АКТИВЕН</span>
          </div>
        </div>
      </header>

      <BugReportModal open={bugReportOpen} onClose={() => setBugReportOpen(false)} />

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

      <main className={styles.main}>
        {isPrivacy ? (
          <PrivacyPage onNavigate={navigate} />
        ) : isGuide ? (
          <GuidePage />
        ) : (
          // toolMode === 'picture' ? (
          //   <PicturePage />
          // ) : (
          <HomePage />
          // )
        )}
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
  );
}
