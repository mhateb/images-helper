import { usePath } from './hooks/usePath';
import { GuidePage } from './pages/GuidePage';
import { HomePage } from './pages/HomePage';
import styles from './App.module.css';

export default function App() {
  const { path, navigate } = usePath();
  const isGuide = path === '/guide';

  return (
    <div className={styles.page}>
      <div className={styles.atmosphere} aria-hidden />

      <header className={styles.brand}>
        <div className={styles.brandRow}>
          <button
            type="button"
            className={styles.brandMarkBtn}
            onClick={() => navigate('/')}
            aria-label="Images Helper — на главную"
          >
            <span className={styles.brandMark}>Images Helper</span>
          </button>
          {isGuide ? (
            <button
              type="button"
              className={styles.guideBtn}
              onClick={() => navigate('/')}
            >
              К инструменту
            </button>
          ) : (
            <button
              type="button"
              className={styles.guideBtn}
              onClick={() => navigate('/guide')}
            >
              Гайд
            </button>
          )}
        </div>
      </header>

      <main className={styles.main}>{isGuide ? <GuidePage /> : <HomePage />}</main>
    </div>
  );
}
