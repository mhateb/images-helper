import type { ReactNode } from 'react';
import { BP } from 'shared';
import styles from '../GuidePage.module.css';
import type { GuideBlock, GuideTab } from './types';

const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;

function renderInline(text: string): ReactNode {
  const parts = text.split(INLINE);
  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code key={index} className={styles.code}>
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function BreakpointsTable() {
  return (
    <div className={styles.bpTable} role="table" aria-label="Брейкпоинты проекта">
      <div className={styles.bpRow} role="row">
        <span className={styles.bpToken} role="cell">
          &lt; md
        </span>
        <span role="cell">&lt; {BP.md}px</span>
        <span role="cell">mobile</span>
      </div>
      <div className={styles.bpRow} role="row">
        <span className={styles.bpToken} role="cell">
          md
        </span>
        <span role="cell">{BP.md}px</span>
        <span role="cell">tablet</span>
      </div>
      <div className={styles.bpRow} role="row">
        <span className={styles.bpToken} role="cell">
          lg
        </span>
        <span role="cell">{BP.lg}px</span>
        <span role="cell">tablet-lg / desktop-small</span>
      </div>
      <div className={styles.bpRow} role="row">
        <span className={styles.bpToken} role="cell">
          xl
        </span>
        <span role="cell">{BP.xl}px</span>
        <span role="cell">desktop</span>
      </div>
    </div>
  );
}

function GuideBlockView({ block }: { block: GuideBlock }) {
  switch (block.type) {
    case 'text':
      return <p className={styles.text}>{renderInline(block.text)}</p>;
    case 'h3':
      return <h3 className={styles.sub}>{block.text}</h3>;
    case 'steps':
      return (
        <ol className={styles.steps}>
          {block.items.map((item, index) => (
            <li key={index}>{renderInline(item)}</li>
          ))}
        </ol>
      );
    case 'list':
      return (
        <ul className={styles.list}>
          {block.items.map((item, index) => (
            <li key={index}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    case 'checklist':
      return (
        <ul className={styles.checklist}>
          {block.items.map((item, index) => (
            <li key={index}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    case 'callout':
      return (
        <div className={styles.callout}>
          <p>{renderInline(block.text)}</p>
        </div>
      );
    case 'code':
      return (
        <pre className={styles.snippet} tabIndex={0}>
          <code>{block.code}</code>
        </pre>
      );
    case 'breakpoints':
      return <BreakpointsTable />;
    case 'figure':
      return (
        <figure className={styles.figure}>
          <img
            src={block.src}
            alt={block.alt}
            className={styles.figureImg}
            loading="lazy"
          />
          <figcaption>{renderInline(block.caption)}</figcaption>
        </figure>
      );
    case 'cards':
      return (
        <div className={styles.cards}>
          {block.cards.map((card) => (
            <div key={card.title} className={styles.card}>
              <h3>{card.title}</h3>
              <p>{renderInline(card.body)}</p>
              {card.when ? <p className={styles.when}>{renderInline(card.when)}</p> : null}
            </div>
          ))}
        </div>
      );
    case 'params':
      return (
        <dl className={styles.params}>
          {block.items.map((item) => (
            <div key={item.term}>
              <dt>{item.term}</dt>
              <dd>{renderInline(item.detail)}</dd>
            </div>
          ))}
        </dl>
      );
    default: {
      const unreachable: never = block;
      return unreachable;
    }
  }
}

export function GuideInline({ text }: { text: string }) {
  return <>{renderInline(text)}</>;
}

export function GuidePanel({ tab }: { tab: GuideTab }) {
  return (
    <div
      className={styles.panel}
      role="tabpanel"
      id={`guide-panel-${tab.id}`}
      aria-labelledby={`guide-tab-${tab.id}`}
    >
      {tab.sections.map((section, index) => (
        <section
          key={section.title}
          className={index === 0 ? styles.sectionFirst : styles.section}
        >
          <h2>{section.title}</h2>
          {section.blocks.map((block, blockIndex) => (
            <GuideBlockView key={blockIndex} block={block} />
          ))}
        </section>
      ))}
    </div>
  );
}
