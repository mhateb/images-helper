import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { MAX_SCREENSHOT_BYTES, MAX_SCREENSHOT_MB } from 'shared';
import { trackGoal, YM_GOALS } from '../analytics/ym';
import { sendBugReport } from '../api/bugReport';
import styles from './BugReportModal.module.css';
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

type BugReportModalProps = {
  open: boolean;
  onClose: () => void;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([hidden]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    if (el.hasAttribute('hidden')) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    return el.tabIndex >= 0;
  });
}

export function BugReportModal({ open, onClose }: BugReportModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sending, setSending] = useState(false);

  const sendingRef = useRef(sending);
  sendingRef.current = sending;

  useEffect(() => {
    if (!open) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => {
      descriptionRef.current?.focus();
    });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (sendingRef.current) return;
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const items = focusableIn(dialog);
      if (items.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus();
    };
  }, [open]);

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
      setError(`Скриншот больше ${MAX_SCREENSHOT_MB} МБ. Сожмите или обрежьте картинку.`);
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
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <div className={styles.head}>
          <div>
            <h2 id={titleId}>Сообщить о проблеме</h2>
            <p id={descriptionId}>Кратко опишите, что случилось. Скриншот очень поможет.</p>
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
              ref={descriptionRef}
              className={styles.textarea}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Например: после обрезки скачался пустой файл…"
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
              <p className={styles.fileHint}>JPEG, PNG, WebP, GIF до {MAX_SCREENSHOT_MB} МБ</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              hidden
              aria-label="Скриншот"
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
                  aria-label="Убрать скриншот"
                >
                  Убрать
                </button>
              </div>
            ) : null}
          </div>

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className={styles.success} role="status">
              Спасибо! Сообщение отправлено.
            </p>
          ) : null}

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
