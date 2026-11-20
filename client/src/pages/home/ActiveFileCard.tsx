import { formatBytes } from '../../utils/format';
import { formatLabel, type ImageItem } from './imageItem';
import styles from '../HomePage.module.css';

export function ActiveFileCard({
  item,
  canRemove,
  onRemove,
  onReset,
}: {
  item: ImageItem;
  canRemove: boolean;
  onRemove: () => void;
  onReset: () => void;
}) {
  return (
    <article className={styles.fileCard}>
      <div className={styles.thumb}>
        <img src={item.imageUrl} alt="" />
      </div>
      <div className={styles.fileInfo}>
        <div className={styles.fileHeader}>
          <p className={styles.fileName}>{item.file.name}</p>
          <div className={styles.fileActions}>
            <span className={styles.loadedPill}>
              {item.results.length > 0 ? 'ГОТОВО' : 'ЗАГРУЖЕНО'}
            </span>
            {canRemove ? (
              <button type="button" className={styles.reset} onClick={onRemove}>
                Удалить
              </button>
            ) : (
              <button type="button" className={styles.reset} onClick={onReset}>
                Другой файл
              </button>
            )}
          </div>
        </div>
        <div className={styles.specs}>
          <div>
            <span>Исходный размер</span>
            <strong>{formatBytes(item.file.size)}</strong>
          </div>
          <div>
            <span>Разрешение</span>
            <strong>
              {item.dimensions ? `${item.dimensions.w} × ${item.dimensions.h}` : '…'}
            </strong>
          </div>
          <div>
            <span>Формат</span>
            <strong>{formatLabel(item.file.type)}</strong>
          </div>
        </div>
      </div>
    </article>
  );
}
