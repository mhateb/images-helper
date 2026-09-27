const CONSENT_KEY = 'fitpix_ym_consent';

export type ConsentStatus = 'granted' | 'denied';

export function getConsent(): ConsentStatus | null {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    if (value === 'granted' || value === 'denied') return value;
  } catch {
    // private mode / blocked storage
  }
  return null;
}

export function setConsent(status: ConsentStatus): void {
  try {
    localStorage.setItem(CONSENT_KEY, status);
  } catch {
    // ignore
  }
}
