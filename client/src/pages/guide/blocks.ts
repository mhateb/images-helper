import type { GuideBlock, GuideCard, GuideParam, GuideSection } from './types';

export const text = (value: string): GuideBlock => ({ type: 'text', text: value });
export const h3 = (value: string): GuideBlock => ({ type: 'h3', text: value });
export const steps = (items: string[]): GuideBlock => ({ type: 'steps', items });
export const list = (items: string[]): GuideBlock => ({ type: 'list', items });
export const checklist = (items: string[]): GuideBlock => ({ type: 'checklist', items });
export const callout = (value: string): GuideBlock => ({ type: 'callout', text: value });
export const code = (value: string): GuideBlock => ({ type: 'code', code: value });
export const breakpoints = (): GuideBlock => ({ type: 'breakpoints' });
export const figure = (src: string, alt: string, caption: string): GuideBlock => ({
  type: 'figure',
  src,
  alt,
  caption,
});
export const cards = (items: GuideCard[]): GuideBlock => ({ type: 'cards', cards: items });
export const params = (items: GuideParam[]): GuideBlock => ({ type: 'params', items });
export const section = (title: string, blocks: GuideBlock[]): GuideSection => ({
  title,
  blocks,
});
