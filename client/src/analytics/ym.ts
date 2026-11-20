import { getConsent } from './consent';

export type GoalParams = Record<string, string | number | boolean | undefined>;

export const YM_GOALS = {
  fileUpload: 'file_upload',
  optimizeStart: 'optimize_start',
  optimizeSuccess: 'optimize_success',
  optimizeError: 'optimize_error',
  download: 'download',
  guideOpen: 'guide_open',
  bugReportOpen: 'bug_report_open',
  bugReportSubmit: 'bug_report_submit',
  queueLimit: 'queue_limit',
  analyzeStart: 'analyze_start',
  analyzeSuccess: 'analyze_success',
  analyzeError: 'analyze_error',
  analyzeZipStart: 'analyze_zip_start',
  analyzeZipSuccess: 'analyze_zip_success',
  analyzeZipError: 'analyze_zip_error',
  analyzeOpenInTool: 'analyze_open_in_tool',
} as const;

type YmQueue = {
  (...args: unknown[]): void;
  a?: unknown[];
  l?: number;
};

declare global {
  interface Window {
    ym?: YmQueue;
    /** Injected by server from runtime env. */
    __FITPIX_YM_ID__?: number;
  }
}

const TAG_SRC = 'https://mc.yandex.ru/metrika/tag.js';

let initPromise: Promise<boolean> | null = null;
let initialized = false;
let lastHitUrl: string | null = null;

function counterId(): number {
  const fromRuntime = Number(window.__FITPIX_YM_ID__ ?? 0);
  if (Number.isFinite(fromRuntime) && fromRuntime > 0) return fromRuntime;
  const fromBuild = Number(import.meta.env.VITE_YM_ID || 0);
  return Number.isFinite(fromBuild) && fromBuild > 0 ? fromBuild : 0;
}

export function hasYmCounter(): boolean {
  return counterId() > 0;
}

function canTrack(): boolean {
  return hasYmCounter() && getConsent() === 'granted' && initialized;
}

function ensureYmStub(): YmQueue {
  if (typeof window.ym === 'function') return window.ym;
  const queue: YmQueue = (...args: unknown[]) => {
    (queue.a = queue.a || []).push(args);
  };
  queue.l = Date.now();
  window.ym = queue;
  return queue;
}

/** tag.js copies this nonce onto scripts it inserts (Webvisor, click map). */
function documentCspNonce(): string {
  const nodes = document.querySelectorAll<HTMLScriptElement | HTMLStyleElement | HTMLLinkElement>(
    'script, style, link',
  );
  for (const node of nodes) {
    if (node.nonce) return node.nonce;
  }
  return '';
}

function injectTagScript(): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${TAG_SRC}"]`);
  if (existing) {
    if (existing.dataset.loaded === '1') return Promise.resolve();
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('YM script failed')), {
        once: true,
      });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TAG_SRC;
    script.async = true;
    const nonce = documentCspNonce();
    if (nonce) script.nonce = nonce;
    script.onload = () => {
      script.dataset.loaded = '1';
      resolve();
    };
    script.onerror = () => reject(new Error('YM script failed'));
    document.head.appendChild(script);
  });
}

export async function initYm(): Promise<boolean> {
  if (!hasYmCounter()) return false;
  if (getConsent() !== 'granted') return false;
  if (initialized) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      ensureYmStub();
      await injectTagScript();
      window.ym?.(counterId(), 'init', {
        defer: true,
        clickmap: true,
        trackLinks: true,
        accurateTrackBounce: true,
        webvisor: true,
      });
      initialized = true;
      return true;
    } catch {
      initPromise = null;
      return false;
    }
  })();

  return initPromise;
}

function cleanParams(params?: GoalParams): Record<string, string | number> | undefined {
  if (!params) return undefined;
  const next: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (typeof value === 'boolean') {
      next[key] = value ? 1 : 0;
    } else {
      next[key] = value;
    }
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

export function trackPage(path: string, title = document.title): void {
  if (!canTrack()) return;
  const url = path.startsWith('/') ? path : `/${path}`;
  if (lastHitUrl === url) return;
  lastHitUrl = url;
  window.ym?.(counterId(), 'hit', url, {
    title,
    params: cleanParams({ path: url }),
  });
}

export function trackGoal(goal: string, params?: GoalParams): void {
  if (!canTrack()) return;
  const cleaned = cleanParams(params);
  if (cleaned) {
    window.ym?.(counterId(), 'reachGoal', goal, cleaned);
  } else {
    window.ym?.(counterId(), 'reachGoal', goal);
  }
}
