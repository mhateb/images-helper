export type GuideTabId = 'basics' | 'source' | 'media' | 'srcset';

export type GuideCard = {
  title: string;
  body: string;
  when?: string;
};

export type GuideParam = {
  term: string;
  detail: string;
};

export type GuideBlock =
  | { type: 'text'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'steps'; items: string[] }
  | { type: 'list'; items: string[] }
  | { type: 'checklist'; items: string[] }
  | { type: 'callout'; text: string }
  | { type: 'code'; code: string }
  | { type: 'breakpoints' }
  | { type: 'figure'; src: string; alt: string; caption: string }
  | { type: 'cards'; cards: GuideCard[] }
  | { type: 'params'; items: GuideParam[] };

export type GuideSection = {
  title: string;
  blocks: GuideBlock[];
};

export type GuideTab = {
  id: GuideTabId;
  label: string;
  hint: string;
  sections: GuideSection[];
};
