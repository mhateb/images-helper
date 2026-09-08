import type { OutputFormat } from '../types';
import styles from './OptionsPanel.module.css';

interface OptionsPanelProps {
  format: OutputFormat;
  trim: boolean;
  resize: boolean;
  resizeMaxWidth: number;
  quality: number;
  busy: boolean;
  disabled?: boolean;
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
  disabled = false,
  onFormatChange,
  onTrimChange,
  onResizeChange,
  onResizeMaxWidthChange,
  onQualityChange,
  onOptimize,
}: OptionsPanelProps) {
  return (
    <aside className={`${styles.panel} ${disabled ? styles.disabled : ''}`}>
      <header className={styles.header}>
        <h2>Настройки оптимизации</h2>
        <p>Точная настройка размера и качества</p>
      </header>

      <div className={styles.divider} />

      <div className={styles.section}>
        <span className={styles.sectionLabel}>Формат</span>
        <div className={styles.formats} role="radiogroup" aria-label="Формат результата">
          {FORMATS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={format === item.id}
              className={`${styles.formatBtn} ${format === item.id ? styles.active : ''}`}
              onClick={() => onFormatChange(item.id)}
              disabled={disabled}
            >
              <strong>{item.label}</strong>
              <span>{item.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.toggleRow}>
        <div>
          <p className={styles.rowTitle}>Обрезать пустое пространство</p>
          <p className={styles.rowHint}>Автоматическая обрезка пустых пикселей по краям</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={trim}
          className={`${styles.switch} ${trim ? styles.on : ''}`}
          onClick={() => onTrimChange(!trim)}
          disabled={disabled}
        >
          <span className={styles.knob} />
        </button>
      </div>

      <div className={styles.divider} />

      <div className={styles.resizeBlock}>
        <div className={styles.resizeHead}>
          <p className={styles.rowTitle}>Изменение размера</p>
          <span className={styles.lockBadge}>
            <img src="/icons/lock.svg" alt="" width={12} height={12} />
            СОХРАНЯТЬ ПРОПОРЦИИ
          </span>
        </div>

        <div className={styles.toggleRow}>
          <div>
            <p className={styles.rowHint}>Уменьшить ширину. Увеличение отключено.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={resize}
            className={`${styles.switch} ${resize ? styles.on : ''}`}
            onClick={() => onResizeChange(!resize)}
            disabled={disabled}
          >
            <span className={styles.knob} />
          </button>
        </div>

        {resize ? (
          <label className={styles.inputField}>
            <span className={styles.inputLabel}>Ширина</span>
            <span className={styles.inputBox}>
              <input
                type="number"
                min={16}
                max={10000}
                step={1}
                value={resizeMaxWidth}
                onChange={(e) => onResizeMaxWidthChange(Number(e.target.value) || 1920)}
                disabled={disabled}
              />
              <span className={styles.unit}>PX</span>
            </span>
          </label>
        ) : null}
      </div>

      <div className={styles.divider} />

      <div className={styles.quality}>
        <div className={styles.qualityHead}>
          <p className={styles.rowTitle}>Качество вывода</p>
          <span className={styles.qualityValue}>{quality}%</span>
        </div>
        <input
          type="range"
          min={40}
          max={100}
          step={1}
          value={quality}
          onChange={(e) => onQualityChange(Number(e.target.value))}
          disabled={disabled}
        />
        <div className={styles.sliderLabels}>
          <span>МАКС. СЖАТИЕ</span>
          <span>БЕЗ ПОТЕРЬ</span>
        </div>
      </div>

      <button
        type="button"
        className={styles.submit}
        onClick={onOptimize}
        disabled={busy || disabled}
      >
        <img src="/icons/zap.svg" alt="" width={16} height={16} />
        {busy ? 'Оптимизируем…' : 'Оптимизировать и сжать'}
      </button>
    </aside>
  );
}
