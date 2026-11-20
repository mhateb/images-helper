import { useRef } from 'react';
import { fileCountLabel, MAX_FILES, type ImageItem } from './imageItem';
import styles from '../HomePage.module.css';

export function ImageQueue({
  items,
  activeId,
  notice,
  onSelect,
  onAdd,
  onReset,
}: {
  items: ImageItem[];
  activeId: string;
  notice: string | null;
  onSelect: (id: string) => void;
  onAdd: (files: File[]) => void;
  onReset: () => void;
}) {
  const addInputRef = useRef<HTMLInputElement>(null);
  const full = items.length >= MAX_FILES;

  return (
    <div className={styles.queue}>
      <div className={styles.queueList} role="list" aria-label="Загруженные изображения">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="listitem"
            className={`${styles.queueItem} ${item.id === activeId ? styles.queueItemActive : ''}`}
            onClick={() => onSelect(item.id)}
            title={item.file.name}
          >
            <img src={item.imageUrl} alt="" />
            {item.results.length > 0 ? <span className={styles.queueDone} aria-hidden /> : null}
            {item.error ? <span className={styles.queueFail} aria-hidden /> : null}
          </button>
        ))}
        <button
          type="button"
          className={styles.queueAdd}
          onClick={() => addInputRef.current?.click()}
          aria-label="Добавить изображения"
          disabled={full}
          title={full ? `Не больше ${MAX_FILES} файлов за раз` : 'Добавить изображения'}
        >
          +
        </button>
        <input
          ref={addInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          multiple
          className={styles.hiddenInput}
          onChange={(event) => {
            void onAdd(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
        />
      </div>
      <div className={styles.queueMeta}>
        <span>
          {items.length}/{MAX_FILES} {fileCountLabel(items.length)}
        </span>
        <button type="button" className={styles.queueAction} onClick={onReset}>
          Очистить
        </button>
      </div>
      {notice ? <p className={styles.queueNotice}>{notice}</p> : null}
    </div>
  );
}
