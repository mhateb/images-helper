import type { OutputFormat } from '../types';
import styles from './OptionsPanel.module.css';

interface OptionsPanelProps {
  format: OutputFormat;
  trim: boolean;
  resize: boolean;
  resizeMaxWidth: number;
  quality: number;
  busy: boolean;
  onFormatChange: (format: OutputFormat) => void;
  onTrimChange: (trim: boolean) => void;
  onResizeChange: (resize: boolean) => void;
  onResizeMaxWidthChange: (width: number) => void;
  onQualityChange: (quality: number) => void;
  onOptimize: () => void;
}

const FORMATS: { id: OutputFormat; label: string; hint: string }[] = [
  { id: 'optimized', label: 'Optimized', hint: 'Тот же формат, сжатие' },
  { id: 'webp', label: 'WebP', hint: 'Универсальный веб' },
  { id: 'avif', label: 'AVIF', hint: 'Максимальное сжатие' },
];

export function OptionsPanel({
  format,
  trim,
  resize,
  resizeMaxWidth,
  quality,
  busy,
  onFormatChange,
  onTrimChange,
  onResizeChange,
  onResizeMaxWidthChange,
  onQualityChange,
  onOptimize,
}: OptionsPanelProps) {
  return (
    <aside className={styles.panel}>
      <header className={styles.header}>
        <h2>Параметры</h2>
        <p>Формат, trim, resize и качество перед оптимизацией.</p>
      </header>

      <div className={styles.section}>
        <span className={styles.label}>Формат</span>
        <div className={styles.formats} role="radiogroup" aria-label="Формат результата">
          {FORMATS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={format === item.id}
              className={`${styles.formatBtn} ${format === item.id ? styles.active : ''}`}
              onClick={() => onFormatChange(item.id)}
            >
              <strong>{item.label}</strong>
              <span>{item.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <label className={styles.toggleRow}>
        <div>
          <span className={styles.label}>Trim</span>
          <p>Авто-обрезка пустых и однотонных краёв после кропа.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={trim}
          className={`${styles.switch} ${trim ? styles.on : ''}`}
          onClick={() => onTrimChange(!trim)}
        >
          <span className={styles.knob} />
        </button>
      </label>

      <div className={styles.resizeBlock}>
        <label className={styles.toggleRow}>
          <div>
            <span className={styles.label}>Resize</span>
            <p>Уменьшить ширину с сохранением пропорций. Увеличение отключено.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={resize}
            className={`${styles.switch} ${resize ? styles.on : ''}`}
            onClick={() => onResizeChange(!resize)}
          >
            <span className={styles.knob} />
          </button>
        </label>

        {resize ? (
          <label className={styles.resizeField}>
            <span className={styles.label}>Макс. ширина (px)</span>
            <input
              type="number"
              min={16}
              max={10000}
              step={1}
              value={resizeMaxWidth}
              onChange={(e) => onResizeMaxWidthChange(Number(e.target.value) || 1920)}
            />
          </label>
        ) : null}
      </div>

      <label className={styles.quality}>
        <div className={styles.qualityHead}>
          <span className={styles.label}>Качество</span>
          <span>{quality}</span>
        </div>
        <input
          type="range"
          min={40}
          max={100}
          step={1}
          value={quality}
          onChange={(e) => onQualityChange(Number(e.target.value))}
        />
      </label>

      <button
        type="button"
        className={styles.submit}
        onClick={onOptimize}
        disabled={busy}
      >
        {busy ? 'Оптимизируем…' : 'Оптимизировать'}
      </button>
    </aside>
  );
}
