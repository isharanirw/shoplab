import { N, toneNamed } from '../colours';
import type { Tone } from '../colours';
import { C, E, Ln, P, Pg, R, S, rng, star, styled, NS } from '../svg';
import type { Look, Motif, SceneContext } from '../types';

/** The cover of a standing book, 3D-ish with page edges. `art` paints inside the cover (x 138-278, y 98-336). */
function cover(l: Look, art: (l: Look) => string): string {
  const { m } = l;
  return (
    Pg([[288, 62], [300, 68], [300, 342], [288, 348]], N.paper) +
    Ln(292, 80, 292, 340, N.steelDark, 1.5, { 'stroke-opacity': 0.6 }) +
    Ln(296, 80, 296, 340, N.steelDark, 1.5, { 'stroke-opacity': 0.6 }) +
    R(112, 50, 176, 298, m.b, 6) +
    R(112, 50, 22, 298, m.d, 6) +
    Ln(134, 50, 134, 348, N.darker, 2, { 'stroke-opacity': 0.4 }) +
    R(148, 66, 128, 9, N.white, 4, { ...NS, opacity: 0.9 }) +
    R(164, 82, 96, 6, N.white, 3, { ...NS, opacity: 0.7 }) +
    art(l)
  );
}

function lying(x: number, y: number, w: number, h: number, t: Tone, band: string): string {
  return (
    R(x, y, w, h, t.b, 4) +
    R(x + 14, y + 7, w - 18, h - 14, N.paper, 3) +
    Ln(x + 20, y + h / 2 - 4, x + w - 10, y + h / 2 - 4, N.steel, 2) +
    Ln(x + 20, y + h / 2 + 4, x + w - 10, y + h / 2 + 4, N.steel, 2) +
    R(x, y, 14, h, t.d, 4) +
    R(x + 3, y + h / 2 - 4, 8, 8, band, 2, NS)
  );
}

function book(art: (l: Look) => string, focus: [number, number]): Motif {
  return {
    focus,
    zoom: 2,
    top: 50,
    base: 348,
    shadow: 100,
    draw: (l) => cover(l, art),
    view3: (alt: Look, ctx: SceneContext) => {
      const names = ['Teal', 'Orange', 'Navy', 'Green', 'Burgundy', 'Purple', 'Blue', 'Yellow'];
      const pick = (n: number) => toneNamed(names[(ctx.seed * 3 + n * 2 + 1) % names.length]!);
      const t1 = pick(0);
      const t2 = pick(1);
      const t3 = pick(2);
      return (
        ctx.bg +
        lying(190, 262, 190, 44, t1, N.glow) +
        lying(204, 220, 168, 42, t2, N.white) +
        lying(196, 180, 176, 40, t3, N.white) +
        E(150, ctx.ground + 5, 100, 8, '#1f2a44', { ...NS, opacity: 0.16 }) +
        styled(cover(alt, art), `translate(50 ${ctx.ground}) rotate(-6 100 280) scale(0.74) translate(-112 -348)`)
      );
    },
  };
}

// ------------------------------------------------------------------ cover art, one per book

const art = {
  tester: (l: Look) =>
    R(160, 112, 92, 134, N.white, 8) +
    S('M170 140 l6 7 l13 -14', N.leaf, 4.5) +
    R(202, 134, 38, 7, N.steel, 3, NS) +
    S('M170 174 l6 7 l13 -14', N.leaf, 4.5) +
    R(202, 168, 38, 7, N.steel, 3, NS) +
    C(182, 212, 7, '#e5484d', NS) +
    Ln(172, 206, 192, 218, '#e5484d', 2.5) +
    Ln(172, 218, 192, 206, '#e5484d', 2.5) +
    R(202, 202, 38, 7, N.steel, 3, NS) +
    C(232, 270, 36, N.glass, { 'fill-opacity': 0.5 }) +
    C(232, 270, 36, 'none', { stroke: l.a.b, 'stroke-width': 9, 'stroke-opacity': 1 }) +
    Ln(258, 296, 272, 316, l.a.b, 11, { 'stroke-opacity': 1 }),

  mystery: (l: Look) => {
    const r = rng(42);
    let stars = '';
    for (let i = 0; i < 9; i++) stars += C(142 + r() * 130, 104 + r() * 100, 1.8, N.white, NS);
    return (
      stars +
      C(246, 134, 17, N.glow, NS) +
      Pg([[218, 190], [284, 164], [284, 216]], N.glow, { ...NS, opacity: 0.45 }) +
      Pg([[190, 306], [226, 306], [218, 206], [198, 206]], N.white) +
      Pg([[194, 276], [222, 276], [220, 252], [196, 252]], '#e5484d', NS) +
      R(196, 188, 22, 18, N.glow, 3) +
      Pg([[192, 188], [222, 188], [207, 168]], '#e5484d') +
      P('M156 322 Q186 296 230 304 Q262 300 274 322Z', N.steelDark) +
      S('M140 324 q10 -8 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0', l.a.l, 4, { 'stroke-opacity': 0.9 })
    );
  },

  aurora: () => {
    const r = rng(7);
    let stars = '';
    for (let i = 0; i < 12; i++) stars += C(140 + r() * 134, 100 + r() * 90, 1.6, N.white, NS);
    return (
      stars +
      S('M138 196 C170 120 200 250 240 160 S272 176 278 150', '#6ee7b7', 24, { 'stroke-opacity': 0.6, 'stroke-linecap': 'butt' }) +
      S('M138 170 C172 110 200 220 240 140 S272 150 278 128', '#34d399', 16, { 'stroke-opacity': 0.55, 'stroke-linecap': 'butt' }) +
      S('M138 224 C170 160 206 270 244 196 S270 206 278 180', '#a78bfa', 14, { 'stroke-opacity': 0.5, 'stroke-linecap': 'butt' }) +
      Pg([[134, 342], [134, 296], [166, 262], [192, 290], [226, 246], [258, 286], [282, 268], [282, 342]], N.darker, NS) +
      Pg([[150, 300], [160, 276], [170, 300]], '#14532d', NS) +
      Pg([[244, 304], [256, 276], [268, 304]], '#14532d', NS)
    );
  },

  cooking: () =>
    S('M190 168 q-10 -16 0 -30 M212 168 q10 -16 0 -30 M234 168 q-10 -16 0 -30', N.white, 4, { 'stroke-opacity': 0.85 }) +
    P('M162 224 Q208 184 254 224Z', N.steelDark) +
    C(208, 192, 7, N.steel) +
    R(164, 222, 90, 66, N.steel, 10) +
    R(148, 240, 18, 11, N.dark, 5) +
    R(252, 240, 18, 11, N.dark, 5) +
    Ln(268, 176, 238, 262, N.wood, 8) +
    E(272, 170, 11, 17, N.wood) +
    C(176, 316, 13, '#e5484d') +
    P('M176 304 q-4 -8 -10 -8 q8 -2 10 8Z', N.leaf, NS) +
    P('M232 316 L252 296 L262 310 Z', '#f08c2e') +
    C(212, 318, 8, N.glow),

  typescript: (l: Look) =>
    S('M190 160 L152 206 L190 252', N.white, 15) +
    S('M232 160 L270 206 L232 252', N.white, 15) +
    S('M220 150 L202 262', N.glow, 12) +
    R(150, 282, 36, 28, N.white, 6) +
    R(194, 282, 36, 28, l.a.b, 6) +
    R(238, 282, 36, 28, N.glow, 6) +
    R(150, 318, 124, 8, N.white, 4, { ...NS, opacity: 0.6 }),

  garden: () =>
    P('M156 322 V212 Q208 148 260 212 V322Z', '#d9f2e2') +
    S('M156 322 V212 Q208 148 260 212 V322', N.white, 8) +
    Ln(208, 164, 208, 322, N.white, 4, { 'stroke-opacity': 0.9 }) +
    Ln(182, 322, 182, 276, N.leafDark, 4) +
    C(182, 268, 11, '#f48fb1') +
    C(182, 268, 4, N.glow, NS) +
    Ln(232, 322, 232, 262, N.leafDark, 4) +
    C(232, 254, 12, N.glow) +
    C(232, 254, 4.5, '#f08c2e', NS) +
    C(160, 320, 24, N.leaf) +
    C(208, 326, 30, N.leafDark) +
    C(256, 320, 24, N.leaf) +
    C(250, 160, 6, '#f48fb1', NS) +
    C(262, 150, 5, '#f48fb1', NS),

  atlas: (l: Look) =>
    C(208, 214, 62, '#7fd1e8') +
    P('M170 190 q18 -14 30 0 q-4 22 -22 18 q-10 8 -8 -18Z', N.leaf, NS) +
    P('M214 224 q22 -6 34 10 q-8 28 -26 18 q-10 -10 -8 -28Z', N.leaf, NS) +
    E(208, 214, 28, 62, 'none', { stroke: N.white, 'stroke-width': 2, 'stroke-opacity': 0.8 }) +
    Ln(146, 214, 270, 214, N.white, 2, { 'stroke-opacity': 0.8 }) +
    S('M140 300 Q208 332 276 300', N.glow, 5) +
    Pg([[250, 120], [256, 138], [274, 144], [256, 150], [250, 168], [244, 150], [226, 144], [244, 138]], l.a.b),

  bedtime: () => {
    const r = rng(11);
    let stars = '';
    for (let i = 0; i < 4; i++) stars += star(150 + r() * 120, 108 + r() * 70, 6 + r() * 4, N.glow, NS);
    return (
      stars +
      P('M222 128 a50 50 0 1 0 36 84 a40 40 0 1 1 -36 -84Z', N.glow) +
      E(208, 316, 74, 20, N.white) +
      E(168, 304, 34, 18, N.white, NS) +
      E(250, 302, 30, 16, N.white, NS) +
      C(188, 290, 16, '#a9744f') +
      C(178, 278, 6, '#a9744f') +
      C(198, 278, 6, '#a9744f') +
      E(214, 300, 24, 12, '#a9744f') +
      S('M182 288 q6 4 12 0', N.darker, 2.5)
    );
  },

  finance: () => {
    const stack = (x: number, n: number) => {
      let out = '';
      for (let i = 0; i < n; i++) out += R(x - 30, 308 - i * 15, 60, 15, '#e8b830', 6) + Ln(x - 22, 315 - i * 15, x + 22, 315 - i * 15, '#b8860b', 2, { 'stroke-opacity': 0.8 });
      return out;
    };
    return (
      R(150, 232, 22, 40, N.white, 3, { ...NS, opacity: 0.35 }) +
      R(180, 206, 22, 66, N.white, 3, { ...NS, opacity: 0.35 }) +
      S('M146 214 L186 176 L212 194 L262 138', N.white, 8) +
      Pg([[270, 132], [244, 134], [266, 158]], N.white) +
      stack(172, 2) +
      stack(238, 4)
    );
  },

  poetry: (l: Look) =>
    P('M262 118 C198 138 162 214 152 300 C196 270 252 228 262 118Z', N.paper) +
    S('M258 130 C216 180 184 240 156 298', l.a.b, 3) +
    S('M236 150 l-26 6 M222 176 l-24 8 M208 202 l-24 12 M196 228 l-22 14', N.steelDark, 2.5) +
    R(196, 292, 46, 36, N.darker, 8) +
    R(208, 282, 22, 14, N.darker, 3) +
    C(219, 310, 6, l.a.b, NS),
};

const coverFocus: Record<string, [number, number]> = {
  bookTester: [220, 220],
  bookMystery: [208, 230],
  bookAurora: [208, 190],
  bookCooking: [208, 240],
  bookTypeScript: [208, 210],
  bookGarden: [208, 240],
  bookAtlas: [208, 214],
  bookBedtime: [208, 220],
  bookFinance: [208, 230],
  bookPoetry: [208, 220],
};

export const books: Record<string, Motif> = {
  bookTester: book(art.tester, coverFocus.bookTester!),
  bookMystery: book(art.mystery, coverFocus.bookMystery!),
  bookAurora: book(art.aurora, coverFocus.bookAurora!),
  bookCooking: book(art.cooking, coverFocus.bookCooking!),
  bookTypeScript: book(art.typescript, coverFocus.bookTypeScript!),
  bookGarden: book(art.garden, coverFocus.bookGarden!),
  bookAtlas: book(art.atlas, coverFocus.bookAtlas!),
  bookBedtime: book(art.bedtime, coverFocus.bookBedtime!),
  bookFinance: book(art.finance, coverFocus.bookFinance!),
  bookPoetry: book(art.poetry, coverFocus.bookPoetry!),
};
