import { lazy, Suspense } from 'react';
import type { CropArea } from '../../types';
import type { ImageItem } from './imageItem';
import styles from '../HomePage.module.css';

const Cropper = lazy(() =>
  import('../../components/Cropper').then((module) => ({ default: module.Cropper })),
);

export function CropBlock({
  item,
  multiple,
  onCropChange,
}: {
  item: ImageItem;
  multiple: boolean;
  onCropChange: (crop: CropArea) => void;
}) {
  return (
    <div className={styles.block}>
      <div className={styles.blockHead}>
        <h2>Обрезка</h2>
        <p>
          Выделите нужную область. Сначала сервер обрежет её, затем уберёт пустые края.
          {multiple ? ' У каждой картинки своя рамка.' : ''}
        </p>
      </div>
      <Suspense fallback={<p className={styles.cropLoading}>Загрузка редактора…</p>}>
        <Cropper
          key={item.id}
          imageUrl={item.imageUrl}
          initialCrop={item.crop}
          onCropChange={onCropChange}
        />
      </Suspense>
    </div>
  );
}
