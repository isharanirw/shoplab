import { N } from '../colours';
import { C, E, Ln, P, Pg, R, S, el, ngon, tf, tube, NS } from '../svg';
import type { Motif } from '../types';

const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];

export const sports: Record<string, Motif> = {
  yogaMat: {
    focus: [296, 128],
    zoom: 2.4,
    top: 98,
    base: 310,
    shadow: 140,
    draw: ({ m, a }) =>
      P('M118 150 H300 L364 308 H54Z', m.b) +
      P('M130 164 H288 L342 296 H76Z', 'none', { stroke: m.l, 'stroke-width': 3, 'stroke-opacity': 0.9 }) +
      Ln(209, 170, 209, 292, m.l, 3, { 'stroke-dasharray': '2 9', 'stroke-opacity': 0.9 }) +
      R(96, 98, 208, 62, m.d, 31) +
      E(304, 129, 27, 31, m.b) +
      S('M304 129 m0 0 a4 4 0 1 1 8 0 a9 9 0 1 1 -18 0 a15 15 0 1 1 30 0', m.d, 3) +
      R(172, 94, 24, 70, a.b, 5),
  },

  dumbbells: {
    focus: [130, 200],
    zoom: 2.3,
    top: 148,
    base: 308,
    shadow: 140,
    copies: false,
    draw: ({ m, a }) =>
      P('M76 254 H324 L304 308 H96Z', N.dark) +
      R(130, 193, 140, 16, N.steel, 7) +
      R(110, 160, 26, 82, m.d, 8) +
      R(264, 160, 26, 82, m.d, 8) +
      R(84, 150, 28, 102, m.b, 9) +
      R(288, 150, 28, 102, m.b, 9) +
      R(64, 180, 22, 42, N.steel, 6) +
      R(314, 180, 22, 42, N.steel, 6) +
      R(180, 186, 40, 30, a.b, 8) +
      C(200, 201, 7, N.white, NS),
  },

  trailShoes: {
    focus: [210, 220],
    zoom: 2.1,
    top: 130,
    base: 328,
    shadow: 150,
    draw: ({ m, a }) => {
      let lugs = 'M54 316';
      for (let i = 0; i < 15; i++) lugs += ' l10 12 l10 -12';
      return (
        P(lugs + ' Z', N.dark, NS) +
        P('M44 296 Q40 270 70 270 H350 Q376 272 372 294 Q368 318 340 318 H72 Q48 318 44 296Z', N.white) +
        P('M64 272 L66 176 Q70 150 100 150 L134 160 Q170 196 214 178 L262 190 Q336 210 364 258 Q372 268 372 274Z', m.b) +
        P('M64 272 L66 176 Q70 156 88 154 L104 272Z', m.d) +
        P('M140 158 Q150 118 190 128 L208 178 Q172 198 142 172Z', m.l) +
        P('M310 214 Q350 232 370 262 L372 274 H298Z', m.d) +
        P('M120 262 Q200 206 300 238 L300 254 Q206 224 120 282Z', a.b, NS) +
        Ln(166, 200, 188, 176, N.white, 5) +
        Ln(190, 204, 212, 182, N.white, 5) +
        Ln(214, 206, 236, 188, N.white, 5) +
        Ln(238, 208, 258, 194, N.white, 5)
      );
    },
  },

  helmet: {
    focus: [206, 150],
    zoom: 2.2,
    top: 90,
    base: 300,
    shadow: 140,
    draw: ({ m, a }) => {
      const vent = (x: number, y: number, rot: number) => el('g', { transform: tf(x, y, rot) }, E(0, 0, 11, 34, N.dark, NS));
      return (
        P('M58 270 Q54 100 206 92 Q340 96 346 270Z', m.b) +
        S('M206 94 V268', a.b, 22, { 'stroke-linecap': 'butt' }) +
        vent(128, 176, -40) +
        vent(170, 150, -14) +
        vent(246, 150, 14) +
        vent(286, 176, 40) +
        P('M58 270 H346 L340 292 Q200 312 64 292Z', m.d) +
        P('M300 262 Q352 244 374 266 L346 284Z', m.d) +
        C(72, 258, 10, a.b)
      );
    },
  },

  tent: {
    focus: [200, 200],
    zoom: 2,
    top: 88,
    base: 330,
    shadow: 0,
    copies: false,
    draw: ({ m, a }) =>
      E(200, 322, 176, 14, '#8cc79d', NS) +
      Ln(52, 296, 12, 328, N.steelDark, 2.5, { 'stroke-opacity': 1 }) +
      Ln(348, 296, 388, 328, N.steelDark, 2.5, { 'stroke-opacity': 1 }) +
      P('M52 320 Q52 94 200 88 Q348 94 348 320Z', m.b) +
      P('M150 320 Q150 190 200 184 Q250 190 250 320Z', N.darker) +
      P('M150 320 Q150 190 200 184 L200 320Z', m.d, { ...NS, opacity: 0.55 }) +
      tube('M92 320 Q96 154 200 124', 16, a.b) +
      tube('M308 320 Q304 154 200 124', 16, a.b) +
      S('M166 308 Q166 214 200 206 Q234 214 234 308', N.steel, 3, { 'stroke-dasharray': '6 5' }) +
      R(174, 296, 52, 20, a.b, 5, { opacity: 0.9 }) +
      Pg([[8, 330], [20, 322], [24, 334]], N.steelDark, NS) +
      Pg([[392, 330], [380, 322], [376, 334]], N.steelDark, NS),
  },

  football: {
    focus: [190, 190],
    zoom: 1.9,
    top: 82,
    base: 318,
    shadow: 100,
    draw: (l) => {
      const { m } = l;
      const clip = l.id('b');
      const cx = 200;
      const cy = 200;
      const inner = ngon(cx, cy, 40, 5, 0);
      let seams = '';
      let outer = '';
      for (let i = 0; i < 5; i++) {
        const ang = -90 + i * 72;
        const [x1, y1] = polar(cx, cy, 40, ang);
        const [x2, y2] = polar(cx, cy, 78, ang);
        seams += `M${Math.round(x1)} ${Math.round(y1)}L${Math.round(x2)} ${Math.round(y2)}`;
        const [px, py] = polar(cx, cy, 122, ang);
        outer += Pg(ngon(px, py, 44, 5, ang + 270), m.b);
      }
      return (
        el('clipPath', { id: clip }, C(cx, cy, 118, '#000', NS)) +
        C(cx, cy, 118, N.white) +
        el('g', { 'clip-path': `url(#${clip})` }, P('M312 110 A118 118 0 0 1 120 312 A150 150 0 0 0 312 110Z', N.steel, { ...NS, opacity: 0.5 }) + outer) +
        S(seams, m.d, 3) +
        Pg(inner, m.b) +
        C(cx, cy, 118, 'none', {}) +
        S('M104 128 A110 110 0 0 1 150 92', N.white, 7, { 'stroke-opacity': 0.9 })
      );
    },
  },

  tennisRacket: {
    focus: [200, 150],
    zoom: 2,
    top: 60,
    base: 340,
    shadow: 120,
    draw: (l) => {
      const { m, a } = l;
      const g = l.id('g');
      const clip = l.id('c');
      return (
        el(
          'g',
          { transform: tf(0, 0, 28, 1, 200, 200) },
          el('pattern', { id: g, width: 14, height: 14, patternUnits: 'userSpaceOnUse' }, Ln(0, 0, 14, 0, N.steelDark, 2, { 'stroke-opacity': 1 }) + Ln(0, 0, 0, 14, N.steelDark, 2, { 'stroke-opacity': 1 })) +
            el('clipPath', { id: clip }, E(200, 150, 63, 79, '#000', NS)) +
            E(200, 150, 63, 79, '#eef5d6', NS) +
            R(130, 66, 140, 170, `url(#${g})`, 0, { ...NS, 'clip-path': `url(#${clip})` }) +
            E(200, 150, 70, 86, 'none', { stroke: m.b, 'stroke-width': 14, 'stroke-opacity': 1 }) +
            E(200, 150, 77, 93, 'none', { stroke: '#1f2a44', 'stroke-width': 1.5, 'stroke-opacity': 0.5 }) +
            P('M150 214 L194 262 H206 L250 214 Q200 238 150 214Z', m.b) +
            R(188, 258, 24, 84, N.dark, 8) +
            Ln(188, 280, 212, 270, a.b, 4) +
            Ln(188, 298, 212, 288, a.b, 4) +
            Ln(188, 316, 212, 306, a.b, 4) +
            R(184, 336, 32, 10, N.darker, 4),
        ) +
        C(306, 304, 34, '#d6e84a') +
        S('M278 288 Q300 306 280 328', N.white, 4.5, { 'stroke-opacity': 1 }) +
        S('M334 280 Q312 300 332 324', N.white, 4.5, { 'stroke-opacity': 1 })
      );
    },
  },

  resistanceBands: {
    focus: [200, 262],
    zoom: 2,
    top: 76,
    base: 322,
    shadow: 130,
    draw: ({ m, a }) => {
      const loop = (cy: number, rx: number, ry: number, colour: string) => tube(`M${200 - rx} ${cy} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0`, 16, colour);
      return (
        loop(288, 134, 26, m.b) +
        loop(270, 108, 22, a.b) +
        loop(254, 82, 18, m.l) +
        tube('M104 150 C104 226 150 232 200 232 C250 232 296 226 296 150', 12, m.d) +
        R(84, 78, 40, 76, a.b, 14) +
        R(276, 78, 40, 76, a.b, 14) +
        R(90, 94, 28, 8, m.d, 3, NS) +
        R(282, 94, 28, 8, m.d, 3, NS) +
        R(90, 112, 28, 8, m.d, 3, NS) +
        R(282, 112, 28, 8, m.d, 3, NS)
      );
    },
  },

  backpack: {
    focus: [200, 250],
    zoom: 2.1,
    top: 56,
    base: 344,
    shadow: 110,
    draw: ({ m, a }) =>
      tube('M174 98 Q200 56 226 98', 7, m.d) +
      R(108, 96, 184, 228, m.b, 56) +
      P('M112 148 Q112 84 200 82 Q288 84 288 148 Q200 176 112 148Z', m.d) +
      P('M108 244 Q74 246 78 306 Q82 326 108 322Z', m.d) +
      P('M292 244 Q326 246 322 306 Q318 326 292 322Z', m.d) +
      R(124, 226, 152, 92, m.l, 22) +
      S('M134 236 H266', N.steel, 3, { 'stroke-dasharray': '7 5' }) +
      R(188, 262, 24, 28, m.d, 5) +
      Ln(108, 196, 292, 196, a.b, 9) +
      R(188, 186, 24, 20, N.steel, 4) +
      R(112, 318, 176, 28, a.b, 14),
  },

  jumpRope: {
    focus: [114, 290],
    zoom: 2.4,
    top: 38,
    base: 346,
    shadow: 110,
    draw: ({ m, a }) =>
      tube('M114 252 C56 14 344 14 286 252', 7, m.b) +
      R(98, 246, 32, 96, a.b, 14) +
      R(270, 246, 32, 96, a.b, 14) +
      R(98, 246, 32, 24, m.d, 10) +
      R(270, 246, 32, 24, m.d, 10) +
      Ln(104, 296, 124, 296, m.d, 3, { 'stroke-opacity': 0.6 }) +
      Ln(104, 312, 124, 312, m.d, 3, { 'stroke-opacity': 0.6 }) +
      Ln(276, 296, 296, 296, m.d, 3, { 'stroke-opacity': 0.6 }) +
      Ln(276, 312, 296, 312, m.d, 3, { 'stroke-opacity': 0.6 }) +
      R(276, 276, 20, 12, N.glow, 2) +
      C(114, 254, 6, N.steel) +
      C(286, 254, 6, N.steel),
  },
};
