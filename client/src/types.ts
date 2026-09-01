export type OutputFormat = 'optimized' | 'webp' | 'avif';

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OptimizeParams {
  file: File;
  format: OutputFormat;
  trim: boolean;
  quality: number;
  resize: boolean;
  resizeMaxWidth: number;
  crop?: CropArea;
}

export interface OptimizeResult {
  blob: Blob;
  url: string;
  originalSize: number;
  optimizedSize: number;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  extension: string;
  format: OutputFormat;
}
