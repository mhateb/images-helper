import { useGuideTab } from '../hooks/useGuideTab';
import styles from './GuidePage.module.css';
import { GUIDE_INTRO, GUIDE_TABS } from './guide/content';
import { GuideInline, GuidePanel } from './guide/GuidePanel';
import { GuideTabs } from './guide/GuideTabs';

export function GuidePage() {
  const { tabId, setTabId } = useGuideTab();
  const tab = GUIDE_TABS.find((item) => item.id === tabId) ?? GUIDE_TABS[0];

  return (
    <article className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.kicker}>{GUIDE_INTRO.kicker}</p>
        <h1>{GUIDE_INTRO.title}</h1>
        <p className={styles.lead}>
          <GuideInline text={GUIDE_INTRO.lead} />
        </p>
      </header>

      <GuideTabs tabs={GUIDE_TABS} activeId={tab.id} onChange={setTabId} />
      <GuidePanel tab={tab} />
    </article>
  );
}
