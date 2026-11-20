import { BP_ORDER, type BreakpointToken } from './breakpoints.js';

export const MAX_FILES = 20;
export const MAX_FILE_MB = 30;
export const MAX_SCREENSHOT_MB = 5;

export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
export const MAX_SCREENSHOT_BYTES = MAX_SCREENSHOT_MB * 1024 * 1024;

/** Multipart field that carries the source for a breakpoint. */
export const ART_FILE_FIELD = {
  md: 'imageMd',
  lg: 'imageLg',
  xl: 'imageXl',
} as const satisfies Record<BreakpointToken, string>;

/** Form prefix for a per-breakpoint crop rectangle. */
export const ART_CROP_PREFIX = {
  md: 'cropMd',
  lg: 'cropLg',
  xl: 'cropXl',
} as const satisfies Record<BreakpointToken, string>;

export const ART_TOKEN_BY_FILE_FIELD: Record<string, BreakpointToken | undefined> =
  Object.fromEntries(BP_ORDER.map((token) => [ART_FILE_FIELD[token], token]));
