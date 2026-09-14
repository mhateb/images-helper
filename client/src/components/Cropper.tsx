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
  initialCrop?: CropArea;
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

function toPercentCrop(
  area: CropArea,
  naturalWidth: number,
  naturalHeight: number,
): PercentCrop {
  return {
    unit: '%',
    x: (area.x / naturalWidth) * 100,
    y: (area.y / naturalHeight) * 100,
    width: (area.width / naturalWidth) * 100,
    height: (area.height / naturalHeight) * 100,
  };
}

export function Cropper({ imageUrl, initialCrop, onCropChange }: CropperProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const initialCropRef = useRef(initialCrop);
  initialCropRef.current = initialCrop;
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
      const saved = initialCropRef.current;
      const next =
        saved && saved.width > 0 && saved.height > 0
          ? toPercentCrop(saved, naturalWidth, naturalHeight)
          : centerCrop({ unit: '%', width: 100, height: 100 }, width, height);
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
