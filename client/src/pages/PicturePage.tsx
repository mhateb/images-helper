import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BP,
  BP_ORDER,
  MAX_FILE_BYTES,
  MAX_FILE_MB,
  buildArtDirectionPicture,
  expectedArtFilenames,
  slotLabel,
  type BreakpointToken,
} from 'shared';
import { downloadBlob, generateArtDirection } from '../api/optimize';
import { Cropper } from '../components/Cropper';
import type { ArtDirectionResult, CropArea } from '../types';
import { formatBytes } from '../utils/format';
import appStyles from '../App.module.css';
import styles from './PicturePage.module.css';

type SlotState = {
  file: File;
  url: string;
  crop?: CropArea;
};

function baseNameFromFile(file: File): string {
  const raw = file.name.replace(/\.[^.]+$/, '') || 'image';
  return (
    raw
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'image'
  );
}

const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/gif';
const DEFAULT_PREVIEW_TOKENS: BreakpointToken[] = ['xl'];

export function PicturePage() {
  const [slots, setSlots] = useState<Partial<Record<BreakpointToken, SlotState>>>({});
  const [activeToken, setActiveToken] = useState<BreakpointToken>('xl');
  const [trim, setTrim] = useState(false);
  const [quality, setQuality] = useState(80);
  const [baseName, setBaseName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ArtDirectionResult | null>(null);
  const [copied, setCopied] = useState(false);

  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  useEffect(() => {
    return () => {
      for (const slot of Object.values(slotsRef.current)) {
        if (slot?.url) URL.revokeObjectURL(slot.url);
      }
    };
  }, []);

  const filledTokens = useMemo(
    () => BP_ORDER.filter((token) => slots[token]?.file),
    [slots],
  );

  const resolvedBase = useMemo(() => {
    if (baseName.trim()) {
      return (
        baseName
          .trim()
          .replace(/[^a-zA-Z0-9._-]+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '') || 'image'
      );
    }
    return slots.xl?.file ? baseNameFromFile(slots.xl.file) : 'image';
  }, [baseName, slots.xl?.file]);

  const previewTokens = useMemo(() => {
    if (result?.tokens?.length) return result.tokens;
    if (filledTokens.length > 0) return filledTokens;
    return DEFAULT_PREVIEW_TOKENS;
  }, [result, filledTokens]);

  const pictureCode = useMemo(
    () =>
      buildArtDirectionPicture({
        baseName: resolvedBase,
        tokens: previewTokens,
        has2x: result?.has2x,
        fallbackExtension: result?.fallbackExtension ?? 'jpg',
        imgWidth: result?.imgWidth,
        imgHeight: result?.imgHeight,
      }),
    [previewTokens, resolvedBase, result],
  );

  const fileList = useMemo(
    () =>
      expectedArtFilenames(
        resolvedBase,
        previewTokens,
        result?.has2x,
        result?.fallbackExtension ?? 'jpg',
      ),
    [previewTokens, resolvedBase, result],
  );

  const setSlotFile = useCallback((token: BreakpointToken, file: File | null) => {
    setResult(null);
    setError(null);
    setSlots((prev) => {
      const next = { ...prev };
      const existing = next[token];
      if (existing?.url) URL.revokeObjectURL(existing.url);
      if (!file) {
        delete next[token];
        return next;
      }
      next[token] = { file, url: URL.createObjectURL(file) };
      return next;
    });
    if (file) {
      setActiveToken(token);
      if (token === 'xl') {
        setBaseName((prev) => prev || baseNameFromFile(file));
      }
    }
  }, []);

  const onPickFile = (token: BreakpointToken, file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Нужен файл изображения (JPEG, PNG, WebP, AVIF, GIF).');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError(`Файл больше ${MAX_FILE_MB} МБ.`);
      return;
    }
    setSlotFile(token, file);
  };

  const onReset = () => {
    setSlots((prev) => {
      for (const slot of Object.values(prev)) {
        if (slot?.url) URL.revokeObjectURL(slot.url);
      }
      return {};
    });
    setResult(null);
    setError(null);
    setBaseName('');
    setActiveToken('xl');
  };

  const onGenerate = async () => {
    if (!slots.xl?.file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const payload: Parameters<typeof generateArtDirection>[0]['slots'] = {};
      for (const token of BP_ORDER) {
        const slot = slots[token];
        if (!slot) continue;
        payload[token] = { file: slot.file, crop: slot.crop };
      }
      const next = await generateArtDirection({
        slots: payload,
        trim,
        quality,
        baseName: resolvedBase,
      });
      setResult(next);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'Не удалось собрать picture.');
    } finally {
      setBusy(false);
    }
  };

  const onDownloadZip = () => {
    if (!result) return;
    downloadBlob(result.zipBlob, result.downloadName);
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(pictureCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError('Не удалось скопировать код.');
    }
  };

  const activeSlot = slots[activeToken];

  return (
    <>
      <p className={appStyles.tagline}>
        Загрузите кадр @2x для каждого брейкпоинта: <strong>md</strong>, <strong>lg</strong> и{' '}
        <strong>xl</strong>. Мы сделаем файлы 1x и 2x в AVIF и WebP и соберём{' '}
        <code>&lt;picture&gt;</code> с media.
      </p>

      <section className={appStyles.workspace}>
        <div className={styles.slotGrid}>
          {BP_ORDER.map((token) => {
            const slot = slots[token];
            const required = token === 'xl';
            return (
              <div
                key={token}
                className={`${styles.slotCard} ${activeToken === token ? styles.slotActive : ''} ${slot ? styles.slotFilled : ''}`}
              >
                <button
                  type="button"
                  className={styles.slotSelect}
                  onClick={() => setActiveToken(token)}
                >
                  <span className={styles.slotToken}>{token}</span>
                  <span className={styles.slotMeta}>{slotLabel(token)}</span>
                  {required ? <span className={styles.required}>обязательно</span> : null}
                </button>

                {slot ? (
                  <div className={styles.slotBody}>
                    <p className={styles.slotFile}>{slot.file.name}</p>
                    <p className={styles.slotSize}>{formatBytes(slot.file.size)}</p>
                    <div className={styles.slotActions}>
                      <label className={styles.slotReplace}>
                        Заменить
                        <input
                          type="file"
                          accept={ACCEPT}
                          className={styles.hiddenInput}
                          onChange={(e) => {
                            onPickFile(token, e.target.files?.[0]);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      {token !== 'xl' ? (
                        <button
                          type="button"
                          className={styles.slotClear}
                          onClick={() => setSlotFile(token, null)}
                        >
                          Убрать
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <label className={styles.slotDrop}>
                    <span>Загрузить {token}@2x</span>
                    <span className={styles.slotHint}>≥ {BP[token] * 2}px по ширине</span>
                    <input
                      type="file"
                      accept={ACCEPT}
                      className={styles.hiddenInput}
                      onChange={(e) => {
                        onPickFile(token, e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
            );
          })}
        </div>

        {slots.xl ? (
          <div className={appStyles.toolbar}>
            <div>
              <p className={appStyles.fileName}>
                Активная обрезка: <strong>{activeToken}</strong>
                {activeSlot ? ` · ${activeSlot.file.name}` : ''}
              </p>
              <p className={appStyles.fileMeta}>
                У каждого брейкпоинта своя обрезка. xl обязателен, md и lg — по желанию.
              </p>
            </div>
            <button type="button" className={appStyles.reset} onClick={onReset}>
              Сбросить всё
            </button>
          </div>
        ) : null}

        <div className={appStyles.grid}>
          <div className={appStyles.previewCol}>
            {activeSlot ? (
              <div className={appStyles.block}>
                <div className={appStyles.blockHead}>
                  <h2>Обрезка · {activeToken}</h2>
                  <p>
                    Рамка действует только для этого кадра. Размеры файлов: {BP[activeToken]}px (1x)
                    и {BP[activeToken] * 2}px (2x).
                  </p>
                </div>
                <Cropper
                  imageUrl={activeSlot.url}
                  onCropChange={(crop) => {
                    setResult(null);
                    setSlots((prev) => {
                      const current = prev[activeToken];
                      if (!current) return prev;
                      return {
                        ...prev,
                        [activeToken]: { ...current, crop },
                      };
                    });
                  }}
                />
              </div>
            ) : (
              <div className={appStyles.block}>
                <div className={appStyles.blockHead}>
                  <h2>Обрезка</h2>
                  <p>Сначала загрузите xl, затем при необходимости md и lg.</p>
                </div>
              </div>
            )}

            <div className={styles.codeBlock}>
              <header className={styles.codeHead}>
                <div>
                  <p className={styles.kicker}>Код для вставки</p>
                  <h2>
                    <code>&lt;picture&gt;</code> + media
                  </h2>
                </div>
                <div className={styles.codeActions}>
                  <button type="button" className={styles.secondaryBtn} onClick={onCopy}>
                    {copied ? 'Скопировано' : 'Копировать'}
                  </button>
                  {result ? (
                    <button type="button" className={styles.primaryBtn} onClick={onDownloadZip}>
                      Скачать ZIP
                    </button>
                  ) : null}
                </div>
              </header>
              <pre className={styles.snippet} tabIndex={0}>
                <code>{pictureCode}</code>
              </pre>
              <div className={styles.fileList}>
                <p className={styles.kicker}>Файлы в ZIP</p>
                <ul>
                  {fileList.map((name) => (
                    <li key={name}>
                      <code>{name}</code>
                    </li>
                  ))}
                  <li>
                    <code>picture.html</code>
                  </li>
                </ul>
              </div>
            </div>

            {error ? <p className={appStyles.error}>{error}</p> : null}
          </div>

          <aside className={styles.panel}>
            <header className={styles.panelHeader}>
              <h2>Арт-директинг</h2>
              <p>
                Для каждого брейкпоинта получите файлы <code>-md</code>, <code>-lg</code>,{' '}
                <code>-xl</code> и их версии <code>-2x</code>, а также разметку с media.
              </p>
            </header>

            <label className={styles.field}>
              <span className={styles.label}>Имя файлов</span>
              <input
                type="text"
                value={baseName}
                onChange={(e) => {
                  setBaseName(e.target.value);
                  setResult(null);
                }}
                placeholder="hero"
              />
            </label>

            <label className={styles.toggleRow}>
              <div>
                <span className={styles.label}>Trim</span>
                <p>Убрать пустые края после обрезки. Применяется к каждому кадру.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={trim}
                className={`${styles.switch} ${trim ? styles.on : ''}`}
                onClick={() => {
                  setTrim((v) => !v);
                  setResult(null);
                }}
              >
                <span className={styles.knob} />
              </button>
            </label>

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
                onChange={(e) => {
                  setQuality(Number(e.target.value));
                  setResult(null);
                }}
              />
            </label>

            <button
              type="button"
              className={styles.submit}
              onClick={onGenerate}
              disabled={busy || !slots.xl}
            >
              <img src="/icons/zap.svg" alt="" width={16} height={16} />
              {busy ? 'Собираем…' : 'Сгенерировать'}
            </button>
          </aside>
        </div>
      </section>
    </>
  );
}
