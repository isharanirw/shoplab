import { CATEGORY_THEMES, N, themeFor, toneNamed, toneOf } from './colours';
import { C, E, P, R, S, NS, OUTLINE, styled } from './svg';
import { FALLBACK_SLUGS, GENERAL_SLUG } from '../lib/productImages';

function categoryName(slug: string): string {
  const found = Object.keys(CATEGORY_THEMES).find((name) => name.toLowerCase() === slug);
  return found ?? 'General';
}

/** A clean category-coloured parcel, shown for a product that has no picture at all. */
export function renderFallback(slug: string): string {
  const theme = themeFor(categoryName(slug));
  const accent = toneNamed(theme.accent);
  const box = toneOf(theme.deep);
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">' +
    R(0, 0, 400, 400, theme.bg, 0, NS) +
    C(90, 90, 80, theme.bg2, NS) +
    C(330, 320, 110, theme.bg2, NS) +
    C(335, 70, 22, theme.deep, { ...NS, opacity: 0.45 }) +
    E(200, 318, 120, 10, OUTLINE, { ...NS, opacity: 0.14 }) +
    styled(
      R(110, 170, 180, 140, box.b, 12) +
        R(100, 148, 200, 38, box.l, 10) +
        R(184, 148, 32, 162, accent.b, 0) +
        P('M200 148 C170 100 130 120 150 148Z', accent.b) +
        P('M200 148 C230 100 270 120 250 148Z', accent.b) +
        S('M120 200 H170 M230 200 H280', N.white, 5, { 'stroke-opacity': 0.55 }),
    ) +
    '</svg>\n'
  );
}

export const FALLBACK_FILES: string[] = [...FALLBACK_SLUGS, GENERAL_SLUG];
