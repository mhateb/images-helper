import styles from '../GuidePage.module.css';
import type { GuideTab, GuideTabId } from './types';

export function GuideTabs({
  tabs,
  activeId,
  onChange,
}: {
  tabs: GuideTab[];
  activeId: GuideTabId;
  onChange: (id: GuideTabId) => void;
}) {
  return (
    <div className={styles.tabs} role="tablist" aria-label="Разделы гайда">
      {tabs.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          id={`guide-tab-${item.id}`}
          aria-selected={activeId === item.id}
          aria-controls={`guide-panel-${item.id}`}
          className={`${styles.tab} ${activeId === item.id ? styles.tabActive : ''}`}
          onClick={() => onChange(item.id)}
        >
          <strong>{item.label}</strong>
          <span>{item.hint}</span>
        </button>
      ))}
    </div>
  );
}
