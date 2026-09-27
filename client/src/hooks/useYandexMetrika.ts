import { useEffect, useRef } from 'react';
import { getConsent } from '../analytics/consent';
import { initYm, trackGoal, trackPage, YM_GOALS } from '../analytics/ym';
import { getSeoRoute } from '../seo/site';

/**
 * Loads YM after consent and sends SPA hits on route changes.
 */
export function useYandexMetrika(path: string, consentVersion: number) {
  const lastGuideGoal = useRef<string | null>(null);

  useEffect(() => {
    if (getConsent() !== 'granted') return;

    let cancelled = false;
    void initYm().then((ok) => {
      if (cancelled || !ok) return;
      const route = getSeoRoute(path);
      trackPage(path, route.title);
      if (path === '/guide' && lastGuideGoal.current !== path) {
        lastGuideGoal.current = path;
        trackGoal(YM_GOALS.guideOpen);
      }
      if (path !== '/guide') {
        lastGuideGoal.current = null;
      }
    });

    return () => {
      cancelled = true;
    };
  }, [path, consentVersion]);
}
