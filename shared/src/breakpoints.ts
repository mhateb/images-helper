/** Widths used by art direction, the guide, and `<picture>` media queries. */
export const BP = {
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

export type BreakpointToken = keyof typeof BP;

export const BP_ORDER: BreakpointToken[] = ['md', 'lg', 'xl'];

export function isBreakpointToken(value: string): value is BreakpointToken {
  return (BP_ORDER as readonly string[]).includes(value);
}

/** Media queries for filled breakpoints, narrow → wide. Last has no media (fallback). */
export function mediaForTokens(
  tokens: BreakpointToken[],
): { token: BreakpointToken; media?: string }[] {
  const present = BP_ORDER.filter((token) => tokens.includes(token));

  return present.map((token, index) => {
    const isLast = index === present.length - 1;
    if (isLast) return { token };

    const next = present[index + 1];
    const nextBp = BP[next];

    if (index === 0) {
      return { token, media: `(max-width: ${nextBp - 1}px)` };
    }

    return {
      token,
      media: `(min-width: ${BP[token]}px) and (max-width: ${nextBp - 1}px)`,
    };
  });
}

export function slotLabel(token: BreakpointToken): string {
  return `${token} · ${BP[token]}px (1x) / ${BP[token] * 2}px (2x)`;
}
