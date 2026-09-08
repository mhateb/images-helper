import { usePath } from './hooks/usePath';
import { GuidePage } from './pages/GuidePage';
import { HomePage } from './pages/HomePage';
// import { PicturePage } from './pages/PicturePage';
import styles from './App.module.css';

// type ToolMode = 'single' | 'picture';

export default function App() {
  const { path, navigate } = usePath();
  const isGuide = path === '/guide';
  // const [toolMode, setToolMode] = useState<ToolMode>('single');

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.logo}
          onClick={() => navigate('/')}
          aria-label="Squeeze.io — на главную"
        >
          <span className={styles.logoIcon} aria-hidden>
            <img src="/icons/crop.svg" alt="" width={16} height={16} />
          </span>
          <span className={styles.logoText}>SQUEEZE.IO</span>
        </button>

        <nav className={styles.tabs} aria-label="Разделы">
          <button
            type="button"
            className={`${styles.tab} ${!isGuide ? styles.tabActive : ''}`}
            onClick={() => navigate('/')}
          >
            Инструмент
          </button>
          <button
            type="button"
            className={`${styles.tab} ${isGuide ? styles.tabActive : ''}`}
            onClick={() => navigate('/guide')}
          >
            Гайд
          </button>
        </nav>

        <div className={styles.status}>
          <span className={styles.statusDot} aria-hidden />
          <span className={styles.statusText}>v1.2.0 АКТИВЕН</span>
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

      <main className={styles.main}>
        {isGuide ? (
          <GuidePage />
        ) : (
          // toolMode === 'picture' ? (
          //   <PicturePage />
          // ) : (
          <HomePage />
          // )
        )}
      </main>
    </div>
  );
}
