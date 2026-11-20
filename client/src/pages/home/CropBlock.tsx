import { Cropper } from '../../components/Cropper';
import type { CropArea } from '../../types';
import type { ImageItem } from './imageItem';
import styles from '../HomePage.module.css';

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
          Потяните границы рамки — выделенная область отправится на сервер первой, затем
          автообрезка краёв.
          {multiple ? ' Для каждой картинки своя область.' : ''}
        </p>
      </div>
      <Cropper
        key={item.id}
        imageUrl={item.imageUrl}
        initialCrop={item.crop}
        onCropChange={onCropChange}
      />
    </div>
  );
}
