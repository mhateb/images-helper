import type { FormEvent } from 'react';
import styles from '../AnalyzePage.module.css';

export function AnalyzeForm({
  url,
  loading,
  onUrlChange,
  onSubmit,
}: {
  url: string;
  loading: boolean;
  onUrlChange: (url: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
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
          onChange={(event) => onUrlChange(event.target.value)}
          disabled={loading}
          required
        />
        <button type="submit" className={styles.submit} disabled={loading || !url.trim()}>
          {loading ? 'Анализ…' : 'Анализ'}
        </button>
      </div>
    </form>
  );
}
