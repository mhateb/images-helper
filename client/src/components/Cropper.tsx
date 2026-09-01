import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react';
import ReactCrop, {
  centerCrop,
  type Crop,
  type PercentCrop,
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import type { CropArea } from '../types';
import styles from './Cropper.module.css';

interface CropperProps {
  imageUrl: string;
  onCropChange: (crop: CropArea) => void;
}

function toNaturalCrop(
  percentCrop: PercentCrop,
  naturalWidth: number,
  naturalHeight: number,
): CropArea {
  return {
    x: (percentCrop.x / 100) * naturalWidth,
    y: (percentCrop.y / 100) * naturalHeight,
    width: (percentCrop.width / 100) * naturalWidth,
    height: (percentCrop.height / 100) * naturalHeight,
  };
}

export function Cropper({ imageUrl, onCropChange }: CropperProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();

  useEffect(() => {
    setCrop(undefined);
  }, [imageUrl]);

  const emitCrop = useCallback(
    (percentCrop: PercentCrop) => {
      const img = imgRef.current;
      if (!img?.naturalWidth || !img.naturalHeight) return;
      if (percentCrop.width <= 0 || percentCrop.height <= 0) return;

      onCropChange(
        toNaturalCrop(percentCrop, img.naturalWidth, img.naturalHeight),
      );
    },
    [onCropChange],
  );

  const onImageLoad = useCallback(
    (e: SyntheticEvent<HTMLImageElement>) => {
      const { width, height, naturalWidth, naturalHeight } = e.currentTarget;
      const next = centerCrop(
        { unit: '%', width: 90, height: 90 },
        width,
        height,
      );
      setCrop(next);
      onCropChange(toNaturalCrop(next, naturalWidth, naturalHeight));
    },
    [onCropChange],
  );

  return (
    <div className={styles.root}>
      <div className={styles.stage}>
        <ReactCrop
          className={styles.crop}
          crop={crop}
          onChange={(_, percentCrop) => setCrop(percentCrop)}
          onComplete={(_, percentCrop) => emitCrop(percentCrop)}
          keepSelection
          minWidth={20}
          minHeight={20}
          ruleOfThirds
        >
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Изображение для кропа"
            onLoad={onImageLoad}
            className={styles.image}
          />
        </ReactCrop>
      </div>
      <p className={styles.hint}>Тяните края и углы рамки или перетаскивайте её целиком.</p>
    </div>
  );
}
