import { useState } from 'react';
import type { GuideTabId } from '../pages/guide/types';

export function useGuideTab(initial: GuideTabId = 'basics') {
  const [tabId, setTabId] = useState<GuideTabId>(initial);
  return { tabId, setTabId };
}
