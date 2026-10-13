/** Colour names used by the illustrations, with a base / dark / light tone for flat shading. */

export interface Tone {
  b: string;
  d: string;
  l: string;
}

function parse(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${m(r1, r2)}${m(g1, g2)}${m(b1, b2)}`;
}

export function toneOf(hex: string): Tone {
  return { b: hex, d: mix(hex, '#101828', 0.25), l: mix(hex, '#ffffff', 0.35) };
}

export const COLOUR_HEX: Record<string, string> = {
  Black: '#3b4050',
  White: '#fbfbfd',
  Grey: '#a3a9b5',
  Charcoal: '#4b5160',
  Navy: '#2f4380',
  'Light Blue': '#8fc4ee',
  Blue: '#3f7fd8',
  Denim: '#4d79b8',
  Red: '#dc4c4c',
  Green: '#3fa56b',
  Purple: '#7e5cc6',
  Orange: '#f28b2c',
  Yellow: '#f5c845',
  Brown: '#8d5c3c',
  Beige: '#dac7a4',
  Cream: '#f6edd5',
  Silver: '#c7cedb',
  Teal: '#2aa5a1',
  Pink: '#ee8bb0',
  Wood: '#dcb36d',
  Olive: '#7c8f4a',
  Burgundy: '#8e2f45',
  Sand: '#e5d3ae',
};

export function toneNamed(name: string): Tone {
  const hex = COLOUR_HEX[name];
  if (!hex) throw new Error(`Unknown colour name: ${name}`);
  return toneOf(hex);
}

/** Neutrals shared by all drawings. */
export const N = {
  white: '#ffffff',
  paper: '#f7f2e6',
  steel: '#cdd4de',
  steelDark: '#8c96a8',
  dark: '#2b3040',
  darker: '#1d212d',
  glass: '#bfe6f5',
  glow: '#ffe28a',
  skin: '#f2c9a3',
  leaf: '#4fae6e',
  leafDark: '#2f8a52',
  pot: '#d9825b',
  wood: '#c99a5b',
  woodDark: '#a67a3f',
} as const;

export interface CategoryTheme {
  /** Light tint used for backgrounds. */
  bg: string;
  /** Mid tint used for decorative shapes and floors. */
  bg2: string;
  /** Deeper tint used for lens rings and horizon bands. */
  deep: string;
  /** Default accent colour name. */
  accent: string;
}

export const CATEGORY_THEMES: Record<string, CategoryTheme> = {
  Electronics: { bg: '#e8effc', bg2: '#d2e0f8', deep: '#a3bdea', accent: 'Teal' },
  Clothing: { bg: '#fbeaf0', bg2: '#f4d3e0', deep: '#e3a6c0', accent: 'Pink' },
  Home: { bg: '#f8f0e3', bg2: '#eddfc3', deep: '#d6bb8a', accent: 'Orange' },
  Sports: { bg: '#e5f5ea', bg2: '#c8e8d2', deep: '#8fcba6', accent: 'Orange' },
  Books: { bg: '#eeebfc', bg2: '#d9d3f6', deep: '#aca1ea', accent: 'Yellow' },
  Toys: { bg: '#fef2d8', bg2: '#fbe0a6', deep: '#f2c065', accent: 'Red' },
  General: { bg: '#eceff4', bg2: '#d9dee8', deep: '#aeb7c8', accent: 'Teal' },
};

export function themeFor(category: string): CategoryTheme {
  return CATEGORY_THEMES[category] ?? CATEGORY_THEMES.General!;
}
