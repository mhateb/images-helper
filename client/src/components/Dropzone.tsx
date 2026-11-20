import { useCallback, useRef, useState, type DragEvent } from 'react';
import { MAX_FILE_BYTES, MAX_FILE_MB, MAX_FILES } from 'shared';
import styles from './Dropzone.module.css';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/gif';
const DEFAULT_HINT = `До ${MAX_FILES} файлов за раз. PNG, JPEG, WEBP, AVIF, GIF до ${MAX_FILE_MB} МБ каждый`;

export type UploadSource = 'drop' | 'picker' | 'analyze';

interface DropzoneProps {
  onFiles: (files: File[], source: UploadSource) => void;
  multiple?: boolean;
  title?: string;
  hint?: string;
  compact?: boolean;
}

function isAcceptedImage(file: File): boolean {
  return file.type.startsWith('image/');
}

export function Dropzone({
  onFiles,
  multiple = true,
  title = 'Перетащите изображения сюда или нажмите для загрузки',
  hint = DEFAULT_HINT,
  compact = false,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    (list: FileList | File[] | null | undefined, source: UploadSource) => {
      if (!list || list.length === 0) return;

      const incoming = Array.from(list);
      const accepted: File[] = [];
      let rejectedType = 0;
      let rejectedSize = 0;

      for (const file of incoming) {
        if (!isAcceptedImage(file)) {
          rejectedType += 1;
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          rejectedSize += 1;
          continue;
        }
        accepted.push(file);
      }

      if (accepted.length === 0) {
        if (rejectedSize > 0) {
          setError(`Файлы больше ${MAX_FILE_MB} МБ. Выберите изображения поменьше.`);
        } else {
          setError('Нужны файлы изображений (JPEG, PNG, WebP, AVIF, GIF).');
        }
        return;
      }

      if (rejectedType > 0 || rejectedSize > 0) {
        const parts: string[] = [];
        if (rejectedType > 0) parts.push(`${rejectedType} не изображение`);
        if (rejectedSize > 0) parts.push(`${rejectedSize} больше ${MAX_FILE_MB} МБ`);
        setError(`Пропущено: ${parts.join(', ')}. Остальные загружены.`);
      } else {
        setError(null);
      }

      onFiles(multiple ? accepted : accepted.slice(0, 1), source);
    },
    [multiple, onFiles],
  );

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    handleFiles(event.dataTransfer.files, 'drop');
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
          multiple={multiple}
          className={styles.input}
          onChange={(e) => {
            handleFiles(e.target.files, 'picker');
            e.target.value = '';
          }}
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
