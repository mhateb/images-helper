import { useCallback, useRef, useState, type DragEvent } from 'react';
import styles from './Dropzone.module.css';

const MAX_BYTES = 30 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/gif';

interface DropzoneProps {
  onFile: (file: File) => void;
  title?: string;
  hint?: string;
  compact?: boolean;
}

export function Dropzone({
  onFile,
  title = 'Перетащите изображение сюда или нажмите для загрузки',
  hint = 'Поддерживаются PNG, JPEG, WEBP до 30 МБ',
  compact = false,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        setError('Нужен файл изображения (JPEG, PNG, WebP, AVIF, GIF).');
        return;
      }

      if (file.size > MAX_BYTES) {
        setError('Файл больше 30 МБ. Выберите изображение поменьше.');
        return;
      }

      setError(null);
      onFile(file);
    },
    [onFile],
  );

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    handleFile(event.dataTransfer.files[0]);
  };

  return (
    <div className={styles.wrap}>
      <div
        className={`${styles.zone} ${compact ? styles.compact : ''} ${dragging ? styles.dragging : ''}`}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className={styles.input}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <div className={styles.iconWrap} aria-hidden>
          <img src="/icons/cloud-upload.svg" alt="" width={24} height={24} />
        </div>
        <div className={styles.text}>
          <p className={styles.title}>{title}</p>
          <p className={styles.hint}>{hint}</p>
        </div>
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
