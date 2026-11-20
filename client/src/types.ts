import type { BreakpointToken } from 'shared';

export type { BreakpointToken };

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

export interface ArtSlotInput {
  file: File;
  crop?: CropArea;
}

export interface ArtDirectionParams {
  slots: Partial<Record<BreakpointToken, ArtSlotInput>>;
  trim: boolean;
  quality: number;
  baseName?: string;
}

export interface ArtDirectionResult {
  zipBlob: Blob;
  tokens: BreakpointToken[];
  has2x: Partial<Record<BreakpointToken, boolean>>;
  fallbackExtension: string;
  imgWidth?: number;
  imgHeight?: number;
  downloadName: string;
}
