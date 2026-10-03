import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { trackGoal, YM_GOALS } from '../analytics/ym';
import { sendBugReport } from '../api/bugReport';
import styles from './BugReportModal.module.css';

const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

type BugReportModalProps = {
  open: boolean;
  onClose: () => void;
};

export function BugReportModal({ open, onClose }: BugReportModalProps) {
  const titleId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !sending) onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, sending]);

  useEffect(() => {
    if (!screenshot) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(screenshot);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [screenshot]);

  useEffect(() => {
    if (!open) {
      setDescription('');
      setContactEmail('');
      setScreenshot(null);
      setError(null);
      setSuccess(false);
      setSending(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [open]);

  if (!open) return null;

  const onPickFile = (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Скриншот должен быть изображением (JPEG, PNG, WebP, GIF).');
      return;
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      setError('Скриншот больше 5 МБ. Сожмите или обрежьте картинку.');
      return;
    }
    setError(null);
    setScreenshot(file);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (sending || success) return;

    const text = description.trim();
    if (text.length < 10) {
      setError('Опишите проблему подробнее (минимум 10 символов).');
      return;
    }

    setSending(true);
    setError(null);
    try {
      await sendBugReport({
        description: text,
        contactEmail,
        screenshot,
      });
      trackGoal(YM_GOALS.bugReportSubmit, {
        has_screenshot: Boolean(screenshot),
        has_email: Boolean(contactEmail.trim()),
      });
      setSuccess(true);
      window.setTimeout(() => onClose(), 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить сообщение');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !sending) onClose();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={styles.head}>
          <div>
            <h2 id={titleId}>Сообщить о проблеме</h2>
            <p>Кратко опишите, что случилось. Скриншот очень поможет.</p>
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            disabled={sending}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <form className={styles.form} onSubmit={onSubmit}>
          <label className={styles.field}>
            <span className={styles.label}>Что произошло</span>
            <textarea
              className={styles.textarea}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Например: после кропа скачался пустой файл…"
              maxLength={4000}
              required
              disabled={sending || success}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>
              Email для ответа <span className={styles.optional}>(необязательно)</span>
            </span>
            <input
              className={styles.input}
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              placeholder="you@example.com"
              disabled={sending || success}
              autoComplete="email"
            />
          </label>

          <div className={styles.field}>
            <span className={styles.label}>
              Скриншот <span className={styles.optional}>(необязательно)</span>
            </span>
            <div className={styles.fileRow}>
              <button
                type="button"
                className={styles.fileBtn}
                onClick={() => fileRef.current?.click()}
                disabled={sending || success}
              >
                Выбрать файл
              </button>
              <p className={styles.fileHint}>JPEG, PNG, WebP, GIF до 5 МБ</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              hidden
              onChange={(event) => onPickFile(event.target.files?.[0])}
            />
            {previewUrl ? (
              <div className={styles.preview}>
                <img src={previewUrl} alt="Превью скриншота" />
                <button
                  type="button"
                  className={styles.removeShot}
                  onClick={() => {
                    setScreenshot(null);
                    if (fileRef.current) fileRef.current.value = '';
                  }}
                  disabled={sending || success}
                >
                  Убрать
                </button>
              </div>
            ) : null}
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}
          {success ? <p className={styles.success}>Спасибо! Сообщение отправлено.</p> : null}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancel}
              onClick={onClose}
              disabled={sending}
            >
              Отмена
            </button>
            <button
              type="submit"
              className={styles.submit}
              disabled={sending || success}
            >
              {sending ? 'Отправка…' : 'Отправить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
