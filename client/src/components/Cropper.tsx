import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react';
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

const MIN_PERCENT = 5;

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

function nudge(crop: Crop, key: string, resize: boolean): PercentCrop {
  const step = resize ? 5 : 1;
  let { x, y, width, height } = crop;
  if (resize) {
    if (key === 'ArrowRight') width += step;
    if (key === 'ArrowLeft') width -= step;
    if (key === 'ArrowDown') height += step;
    if (key === 'ArrowUp') height -= step;
  } else {
    if (key === 'ArrowLeft') x -= step;
    if (key === 'ArrowRight') x += step;
    if (key === 'ArrowUp') y -= step;
    if (key === 'ArrowDown') y += step;
  }
  width = Math.min(100, Math.max(MIN_PERCENT, width));
  height = Math.min(100, Math.max(MIN_PERCENT, height));
  x = Math.min(Math.max(0, x), 100 - width);
  y = Math.min(Math.max(0, y), 100 - height);
  return { unit: '%', x, y, width, height };
}

function cropAnnouncement(crop: PercentCrop): string {
  return `Рамка ${Math.round(crop.width)} на ${Math.round(crop.height)} процентов`;
}

export function Cropper({ imageUrl, initialCrop, onCropChange }: CropperProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const initialCropRef = useRef(initialCrop);
  initialCropRef.current = initialCrop;
  const hintId = useId();
  const [crop, setCrop] = useState<Crop>();
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    setCrop(undefined);
    setAnnouncement('');
  }, [imageUrl]);

  useEffect(() => {
    const root = stageRef.current;
    if (!root) return;
    root
      .querySelectorAll(
        '.ReactCrop__drag-elements, .ReactCrop__rule-of-thirds-hz, .ReactCrop__rule-of-thirds-vt, .ReactCrop__crop-selection',
      )
      .forEach((el) => {
        el.setAttribute('aria-hidden', 'true');
      });
  }, [crop]);

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
      const frame = centerCrop({ unit: '%', width: 100, height: 100 }, width, height);
      const next: PercentCrop =
        saved && saved.width > 0 && saved.height > 0
          ? toPercentCrop(saved, naturalWidth, naturalHeight)
          : {
              unit: '%',
              x: frame.x,
              y: frame.y,
              width: frame.width,
              height: frame.height,
            };
      setCrop(next);
      setAnnouncement(cropAnnouncement(next));
      onCropChange(toNaturalCrop(next, naturalWidth, naturalHeight));
    },
    [onCropChange],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!crop || crop.unit !== '%' || !event.key.startsWith('Arrow')) return;
    event.preventDefault();
    const next = nudge(crop, event.key, event.shiftKey);
    setCrop(next);
    setAnnouncement(cropAnnouncement(next));
    emitCrop(next);
  };

  return (
    <div className={styles.root}>
      <div
        ref={stageRef}
        className={styles.stage}
        role="group"
        tabIndex={0}
        aria-label="Область обрезки"
        aria-describedby={hintId}
        onKeyDown={onKeyDown}
      >
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
            alt="Изображение для обрезки"
            onLoad={onImageLoad}
            className={styles.image}
          />
        </ReactCrop>
        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
      </div>
      <p id={hintId} className={styles.hint}>
        Тяните края и углы рамки или двигайте её целиком. С клавиатуры: стрелки двигают рамку,
        Shift со стрелками меняет размер.
      </p>
    </div>
  );
}
