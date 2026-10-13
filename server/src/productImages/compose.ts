import { N, themeFor, toneNamed } from './colours';
import type { CategoryTheme } from './colours';
import { MOTIFS } from './library';
import { C, E, G, Ln, OUTLINE, P, Pg, R, S, el, num, rng, styled, tf, NS } from './svg';
import type { Look, Motif, SceneContext, SceneKind } from './types';

export interface ProductArt {
  id: number;
  category: string;
  motif: string;
  /** Main colour, alternative colour for the third picture, optional third colour for a smaller copy. */
  colours: [string, string] | [string, string, string];
}

export const VIEW_COUNT = 3;
export const MAX_SVG_BYTES = 8 * 1024;

const SCENE_BY_CATEGORY: Record<string, SceneKind> = {
  Electronics: 'desk',
  Clothing: 'wardrobe',
  Home: 'room',
  Sports: 'outdoor',
  Books: 'shelf',
  Toys: 'play',
};

function makeLook(colour: string, accent: string, u: string): Look {
  return { m: toneNamed(colour), a: toneNamed(accent), u, id: (name) => `${u}${name}` };
}

/** The drawn object wrapped in the shared outline style. */
function objectGroup(motif: Motif, look: Look, transform?: string): string {
  return styled(motif.draw(look), transform);
}

function svgDocument(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">${inner}</svg>\n`;
}

function decor(theme: CategoryTheme, seed: number, tone: 'bg' | 'bg2'): string {
  const rand = rng(seed * 131 + 17);
  const c1 = theme[tone === 'bg' ? 'bg2' : 'bg'];
  return (
    C(40 + rand() * 120, 50 + rand() * 90, 70 + rand() * 40, c1, NS) +
    C(250 + rand() * 120, 270 + rand() * 90, 90 + rand() * 50, c1, NS) +
    C(300 + rand() * 70, 50 + rand() * 60, 16 + rand() * 14, theme.deep, { ...NS, opacity: 0.45 })
  );
}

// ---------------------------------------------------------------- view 1: the product on its own

function view1(art: ProductArt, motif: Motif, look: Look, theme: CategoryTheme): string {
  const shadow = motif.shadow ?? 120;
  const base = motif.base ?? 320;
  return (
    R(0, 0, 400, 400, theme.bg, 0, NS) +
    decor(theme, art.id, 'bg') +
    (shadow > 0 ? E(200, base + 6, shadow, 10, OUTLINE, { ...NS, opacity: 0.14 }) : '') +
    objectGroup(motif, look)
  );
}

// ---------------------------------------------------------------- view 2: a close-up inside a lens

function view2(art: ProductArt, motif: Motif, look: Look, theme: CategoryTheme): string {
  const [fx, fy] = motif.focus;
  const z = motif.zoom ?? 2;
  const clip = look.id('lens');
  return (
    R(0, 0, 400, 400, theme.bg2, 0, NS) +
    decor(theme, art.id + 5, 'bg2') +
    el('clipPath', { id: clip }, C(200, 190, 160, '#000', NS)) +
    C(200, 190, 160, theme.bg, NS) +
    G(objectGroup(motif, look, `${tf(200, 190, 0, z)} translate(${num(-fx)} ${num(-fy)})`), { 'clip-path': `url(#${clip})` }) +
    C(200, 190, 160, 'none', { stroke: theme.deep, 'stroke-width': 12, 'stroke-opacity': 1 }) +
    S('M105 105 A130 130 0 0 1 175 72', N.white, 9, { 'stroke-opacity': 0.7 }) +
    Ln(316, 306, 366, 358, theme.deep, 26)
  );
}

// ---------------------------------------------------------------- view 3: in a scene, in another colour

function plant(x: number, y: number, s = 1): string {
  return G(
    P('M-30 0 L-22 -46 H22 L30 0Z', N.pot) +
      P('M0 -46 C-30 -80 -44 -110 -34 -150 C-10 -120 0 -90 0 -46Z', N.leaf) +
      P('M0 -46 C30 -90 48 -110 46 -148 C16 -122 4 -90 0 -46Z', N.leafDark) +
      P('M0 -46 C-4 -90 6 -120 14 -158 C20 -120 12 -80 0 -46Z', N.leaf),
    { transform: tf(x, y, 0, s) },
  );
}

function scene(kind: SceneKind, theme: CategoryTheme): { bg: string; ground: number } {
  const wall = R(0, 0, 400, 400, theme.bg, 0, NS);
  switch (kind) {
    case 'desk':
      return {
        ground: 304,
        bg:
          wall +
          R(34, 44, 100, 76, N.white, 6) +
          P('M34 120 L66 84 L88 106 L104 90 L134 120Z', theme.deep, NS) +
          C(110, 68, 9, N.glow, NS) +
          plant(346, 304, 0.8) +
          R(0, 304, 400, 96, theme.deep, 0, NS) +
          R(0, 304, 400, 10, theme.bg2, 0, NS) +
          Ln(0, 314, 400, 314, OUTLINE, 3, { 'stroke-opacity': 0.25 }),
      };
    case 'room':
      return {
        ground: 318,
        bg:
          wall +
          R(40, 40, 120, 130, '#cfe8f7', 6) +
          Ln(100, 40, 100, 170, N.white, 6) +
          Ln(40, 105, 160, 105, N.white, 6) +
          R(0, 300, 400, 100, '#e6cfa6', 0, NS) +
          Ln(0, 340, 400, 340, '#c9ad7c', 3, { 'stroke-opacity': 0.7 }) +
          Ln(0, 372, 400, 372, '#c9ad7c', 3, { 'stroke-opacity': 0.7 }) +
          plant(352, 322, 0.95) +
          E(200, 326, 160, 22, theme.bg2, NS),
      };
    case 'wardrobe':
      return {
        ground: 300,
        bg:
          wall +
          R(0, 300, 400, 100, theme.bg2, 0, NS) +
          Ln(0, 60, 400, 60, '#8b94a6', 8) +
          Ln(28, 40, 28, 60, '#8b94a6', 6) +
          Ln(372, 40, 372, 60, '#8b94a6', 6) +
          Ln(0, 304, 400, 304, theme.deep, 4),
      };
    case 'shelf':
      return {
        ground: 306,
        bg:
          wall +
          R(0, 306, 400, 18, N.wood, 0, NS) +
          R(0, 324, 400, 8, N.woodDark, 0, NS) +
          R(0, 332, 400, 68, theme.bg2, 0, NS) +
          plant(352, 306, 0.75),
      };
    case 'outdoor':
      return {
        ground: 314,
        bg:
          R(0, 0, 400, 400, '#d9f0f8', 0, NS) +
          C(332, 78, 38, '#ffd978', NS) +
          E(90, 90, 52, 18, N.white, NS) +
          E(130, 78, 36, 16, N.white, NS) +
          P('M0 270 Q90 190 190 262 T400 240 V330 H0Z', theme.bg2, NS) +
          P('M0 300 Q110 240 230 296 T400 280 V340 H0Z', theme.deep, NS) +
          R(0, 306, 400, 94, '#a6d8b4', 0, NS) +
          E(200, 322, 150, 12, '#7fbf93', NS),
      };
    case 'play': {
      const flagColours = ['#f4a261', '#e76f51', '#f4d35e', '#7bc6cc', '#b8a4e8', '#e76f51', '#f4d35e'];
      const flags = flagColours
        .map((colour, i) => {
          const x = 20 + i * 58;
          const y = 52 + Math.sin(i * 0.9) * 8;
          return Pg(
            [
              [x, y - 16],
              [x + 36, y - 12],
              [x + 16, y + 30],
            ],
            colour,
            NS,
          );
        })
        .join('');
      return {
        ground: 318,
        bg:
          wall +
          S('M0 40 Q200 80 400 40', OUTLINE, 3, { 'stroke-opacity': 0.4 }) +
          flags +
          R(0, 310, 400, 90, theme.bg2, 0, NS) +
          C(60, 360, 22, '#7bc6cc', NS) +
          C(340, 372, 18, '#f4a261', NS) +
          C(280, 350, 10, '#e76f51', NS) +
          E(200, 330, 150, 18, theme.deep, { ...NS, opacity: 0.45 }),
      };
    }
  }
}

function hanger(cx: number, topY: number, half: number): string {
  return (
    S(`M${num(cx)} 62 V${num(topY - 22)} a7 7 0 1 1 7 7`, '#8b94a6', 4) +
    S(`M${num(cx - half)} ${num(topY + 4)} L${num(cx)} ${num(topY - 12)} L${num(cx + half)} ${num(topY + 4)}`, '#8b94a6', 5)
  );
}

function view3(art: ProductArt, motif: Motif, theme: CategoryTheme, withCopies: number): string {
  const [mainName, altName, thirdName] = art.colours;
  const accent = theme.accent;
  const alt = makeLook(altName, accent, 'p');
  const kind = motif.scene ?? SCENE_BY_CATEGORY[art.category] ?? 'room';
  const hang = motif.hang === true;
  const sc = scene(hang ? 'wardrobe' : kind === 'wardrobe' ? 'shelf' : kind, theme);
  if (motif.view3) {
    const ctx: SceneContext = { theme, look: (c, u) => makeLook(c, accent, u), seed: art.id, mainColour: mainName, altColour: altName, bg: sc.bg, ground: sc.ground };
    return motif.view3(alt, ctx);
  }
  const s = motif.sceneScale ?? 0.72;
  const top = motif.top ?? 70;
  const base = motif.base ?? 320;
  const place = (cx: number, scale: number) =>
    hang
      ? `translate(${num(cx)} 116) scale(${num(scale)}) translate(-200 ${num(-top)})`
      : `translate(${num(cx)} ${num(sc.ground)}) scale(${num(scale)}) translate(-200 ${num(-base)})`;
  let inner = sc.bg;
  const copies: [number, string, string][] = [
    [84, mainName, 'q'],
    [316, thirdName ?? mainName, 'r'],
  ];
  if (motif.copies !== false) {
    for (const [cx, colour, u] of copies.slice(0, withCopies)) {
      const look = makeLook(colour, accent, u);
      if (hang) inner += hanger(cx, 116, 60 * s * 0.62 + 10);
      inner += objectGroup(motif, look, place(cx, s * 0.6));
    }
  }
  const shadow = motif.shadow ?? 120;
  if (!hang && shadow > 0) inner += E(200, sc.ground + 5, shadow * s, 8, OUTLINE, { ...NS, opacity: 0.16 });
  if (hang) inner += hanger(200, 116, 60 * s + 12);
  inner += objectGroup(motif, alt, place(200, s));
  return inner;
}

/** One finished SVG file for one picture (view 1 to 3) of a product. */
export function renderView(art: ProductArt, view: 1 | 2 | 3): string {
  const motif = MOTIFS[art.motif];
  if (!motif) throw new Error(`Product ${art.id} uses an unknown motif: ${art.motif}`);
  const theme = themeFor(art.category);
  const [mainName] = art.colours;
  const look = makeLook(mainName, theme.accent, 'p');
  if (view === 1) return svgDocument(view1(art, motif, look, theme));
  if (view === 2) return svgDocument(view2(art, motif, look, theme));
  for (let copies = 2; copies >= 0; copies--) {
    const doc = svgDocument(view3(art, motif, theme, copies));
    if (Buffer.byteLength(doc) <= MAX_SVG_BYTES - 512 || copies === 0) return doc;
  }
  throw new Error('unreachable');
}
