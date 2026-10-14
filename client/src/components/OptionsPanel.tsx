import type { OutputFormat } from '../types';
import styles from './OptionsPanel.module.css';

interface OptionsPanelProps {
  formats: OutputFormat[];
  trim: boolean;
  resize: boolean;
  resizeMaxWidth: number;
  originalWidth?: number;
  quality: number;
  busy: boolean;
  disabled?: boolean;
  fileCount?: number;
  progress?: { done: number; total: number } | null;
  onFormatsChange: (formats: OutputFormat[]) => void;
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
  formats,
  trim,
  resize,
  resizeMaxWidth,
  originalWidth,
  quality,
  busy,
  disabled = false,
  fileCount = 0,
  progress = null,
  onFormatsChange,
  onTrimChange,
  onResizeChange,
  onResizeMaxWidthChange,
  onQualityChange,
  onOptimize,
}: OptionsPanelProps) {
  const toggleFormat = (id: OutputFormat) => {
    if (formats.includes(id)) {
      if (formats.length === 1) return;
      onFormatsChange(formats.filter((item) => item !== id));
      return;
    }
    onFormatsChange(
      FORMATS.map((item) => item.id).filter((item) => formats.includes(item) || item === id),
    );
  };
  const submitLabel = (() => {
    if (busy && progress && progress.total > 1) {
      return `Оптимизируем… ${progress.done}/${progress.total}`;
    }
    if (busy) return 'Оптимизируем…';
    if (fileCount > 1) {
      const mod10 = fileCount % 10;
      const mod100 = fileCount % 100;
      const word =
        mod10 === 1 && mod100 !== 11
          ? 'файл'
          : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
            ? 'файла'
            : 'файлов';
      return `Оптимизировать ${fileCount} ${word}`;
    }
    return 'Оптимизировать и сжать';
  })();

  return (
    <aside className={`${styles.panel} ${disabled ? styles.disabled : ''}`}>
      <header className={styles.header}>
        <h2>Настройки оптимизации</h2>
        <p>Точная настройка размера и качества</p>
      </header>

      <div className={styles.divider} />

      <div className={styles.section}>
        <span className={styles.sectionLabel}>Форматы</span>
        <p className={styles.sectionHint}>Можно выбрать несколько — каждый даст отдельный файл</p>
        <div className={styles.formats} role="group" aria-label="Форматы результата">
          {FORMATS.map((item) => {
            const selected = formats.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                role="checkbox"
                aria-checked={selected}
                className={`${styles.formatBtn} ${selected ? styles.active : ''}`}
                onClick={() => toggleFormat(item.id)}
                disabled={disabled}
              >
                <strong>{item.label}</strong>
                <span>{item.hint}</span>
              </button>
            );
          })}
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
        <p className={styles.rowTitle}>Изменение размера</p>

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
                onChange={(e) =>
                  onResizeMaxWidthChange(
                    Number(e.target.value) || originalWidth || 1920,
                  )
                }
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
        {submitLabel}
      </button>
    </aside>
  );
}
