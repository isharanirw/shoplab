import { N } from '../colours';
import { C, E, Ln, P, Pg, R, S, el, tf, NS } from '../svg';
import type { Motif } from '../types';

function strands(x: number, y0: number, y1: number, step: number, len: number): string {
  let d = '';
  for (let y = y0; y <= y1; y += step) d += `M${x} ${y}h${len}`;
  return d;
}

export const home: Record<string, Motif> = {
  plates: {
    focus: [150, 170],
    zoom: 1.9,
    top: 66,
    base: 330,
    shadow: 120,
    draw: ({ m, a }) => {
      const plate = (cx: number, cy: number, r: number) =>
        C(cx, cy, r, m.b) +
        C(cx, cy, r - 14, m.l, { ...NS, opacity: 0.9 }) +
        C(cx, cy, r - 8, 'none', { stroke: a.b, 'stroke-width': 3, 'stroke-opacity': 1 }) +
        C(cx, cy, r - 26, 'none', { stroke: m.d, 'stroke-width': 2, 'stroke-opacity': 0.35 });
      return (
        plate(132, 140, 72) +
        plate(268, 136, 70) +
        plate(200, 224, 108) +
        C(200, 224, 30, a.b, { ...NS, opacity: 0.9 }) +
        C(200, 224, 14, m.b, NS) +
        S('M120 190 Q150 170 190 170', N.white, 7, { 'stroke-opacity': 0.8 })
      );
    },
  },

  bottle: {
    focus: [200, 70],
    zoom: 2.3,
    top: 20,
    base: 326,
    shadow: 62,
    draw: ({ m, a }) =>
      S('M178 44 V24 H222 V44', N.dark, 9, { 'stroke-linejoin': 'round' }) +
      R(158, 40, 84, 46, N.dark, 12) +
      R(172, 80, 56, 40, m.d, 10) +
      R(144, 108, 112, 218, m.b, 32) +
      R(144, 190, 112, 40, a.b, 0, NS) +
      Ln(144, 190, 256, 190, N.dark, 2, { 'stroke-opacity': 0.3 }) +
      Ln(144, 230, 256, 230, N.dark, 2, { 'stroke-opacity': 0.3 }) +
      R(158, 124, 14, 188, N.white, 7, { ...NS, opacity: 0.4 }) +
      Ln(172, 56, 228, 56, N.steel, 3),
  },

  tableLamp: {
    focus: [200, 170],
    zoom: 2,
    top: 92,
    base: 318,
    shadow: 80,
    draw: ({ m, a }) =>
      C(200, 160, 140, N.glow, { ...NS, opacity: 0.25 }) +
      R(190, 208, 20, 90, N.steel, 6) +
      E(200, 310, 68, 14, N.woodDark) +
      E(200, 302, 68, 14, N.wood) +
      P('M126 92 L274 92 L306 208 L94 208Z', m.b) +
      E(200, 92, 74, 11, m.d) +
      Pg([[107, 168], [293, 168], [298, 186], [102, 186]], a.b, NS) +
      E(200, 208, 106, 14, N.glow) +
      C(200, 262, 6, a.b, NS) +
      S('M190 250 A14 14 0 0 1 210 250', a.b, 3.5) +
      S('M182 240 A26 26 0 0 1 218 240', a.b, 3.5) +
      Ln(274, 94, 286, 196, N.steelDark, 2.5),
  },

  pillow: {
    focus: [200, 190],
    zoom: 2,
    top: 80,
    base: 270,
    shadow: 150,
    draw: ({ m, a }) => {
      const body = 'M56 200 Q52 122 128 138 Q200 164 272 138 Q348 122 344 200 Q348 278 272 262 Q200 238 128 262 Q52 278 56 200Z';
      return (
        el('g', { transform: tf(22, -50, 0, 0.88, 200, 200) }, P(body, m.l)) +
        P(body, m.b) +
        P('M70 236 Q130 270 200 248 Q270 270 330 236 Q346 270 272 262 Q200 238 128 262 Q54 270 70 236Z', m.d, { ...NS, opacity: 0.3 }) +
        S('M82 198 Q200 228 318 198', m.d, 2.5, { 'stroke-dasharray': '7 5', 'stroke-opacity': 0.5 }) +
        C(130, 190, 5, a.b, { ...NS, opacity: 0.7 }) +
        C(270, 190, 5, a.b, { ...NS, opacity: 0.7 }) +
        C(200, 206, 5, a.b, { ...NS, opacity: 0.7 })
      );
    },
  },

  blanket: {
    focus: [64, 250],
    zoom: 2.4,
    top: 118,
    base: 312,
    shadow: 150,
    draw: (l) => {
      const { m, a } = l;
      const p = l.id('p');
      const layer = (x: number, y: number, w: number, h: number) =>
        R(x, y, w, h, m.b, 8) + R(x, y, w, h, `url(#${p})`, 8, NS);
      return (
        el(
          'pattern',
          { id: p, width: 56, height: 52, patternUnits: 'userSpaceOnUse' },
          R(0, 14, 56, 10, a.b, 0, { ...NS, opacity: 0.6 }) + R(16, 0, 10, 52, a.b, 0, { ...NS, opacity: 0.6 }) + R(36, 0, 3, 52, m.d, 0, { ...NS, opacity: 0.35 }),
        ) +
        S(strands(58, 196, 304, 9, -20), m.d, 3.5) +
        S(strands(342, 196, 304, 9, 20), m.d, 3.5) +
        layer(58, 184, 284, 128) +
        P('M58 184 H342 L336 218 H64Z', m.l, { ...NS, opacity: 0.55 }) +
        S(strands(74, 130, 176, 9, -18), m.d, 3.5) +
        S(strands(326, 130, 176, 9, 18), m.d, 3.5) +
        layer(74, 118, 252, 70)
      );
    },
  },

  candles: {
    focus: [200, 220],
    zoom: 2.2,
    top: 94,
    base: 316,
    shadow: 140,
    draw: ({ m, a }) => {
      const jar = (cx: number, w: number, h: number, body: string) => {
        const top = 316 - h;
        const lx = cx - w / 2;
        return (
          C(cx, top - 24, 30, N.glow, { ...NS, opacity: 0.35 }) +
          R(lx, top, w, h, body, 14) +
          E(cx, top + 4, w / 2 - 6, 6, N.paper, NS) +
          Ln(cx, top + 4, cx, top - 10, N.darker, 3) +
          P(`M${cx} ${top - 8} q-11 -16 0 -38 q11 22 0 38Z`, N.glow) +
          R(lx + 9, top + h * 0.36, w - 18, h * 0.38, N.paper, 8) +
          P(`M${cx - 8} ${top + h * 0.62} q8 -20 16 0 q-8 6 -16 0Z`, a.b, NS)
        );
      };
      return jar(104, 92, 132, m.b) + jar(298, 92, 110, m.l) + jar(200, 112, 168, a.b);
    },
  },

  robotVacuum: {
    focus: [210, 176],
    zoom: 2.1,
    top: 130,
    base: 262,
    shadow: 150,
    draw: ({ m, a }) =>
      P('M60 200 V232 A140 62 0 0 0 340 232 V200Z', m.d) +
      E(200, 200, 140, 62, m.b) +
      E(200, 198, 114, 48, m.l, { ...NS, opacity: 0.8 }) +
      R(236, 150, 52, 20, N.dark, 0, NS) +
      E(262, 170, 26, 10, N.dark) +
      E(262, 150, 26, 10, N.darker) +
      E(160, 204, 30, 14, N.dark) +
      E(160, 204, 19, 8, a.b, NS) +
      S('M76 218 Q200 290 324 218', N.dark, 5, { 'stroke-opacity': 0.8 }) +
      S('M92 176 Q130 154 170 152', N.white, 5, { 'stroke-opacity': 0.5 }),
  },

  cuttingBoard: {
    focus: [260, 232],
    zoom: 2.2,
    top: 96,
    base: 310,
    shadow: 0,
    draw: (l) => {
      const { m, a } = l;
      const p = l.id('b');
      const slice = (cx: number, cy: number, r: number) =>
        C(cx, cy, r, '#8fc660') + C(cx, cy, r - 6, '#e4f2c3', NS) + C(cx, cy, r - 18, '#cfe6a0', NS) + C(cx - 6, cy - 4, 2.4, '#8fc660', NS) + C(cx + 6, cy + 3, 2.4, '#8fc660', NS) + C(cx + 2, cy - 8, 2.4, '#8fc660', NS);
      return el(
        'g',
        { transform: tf(0, 0, -6, 1, 200, 200) },
        el('pattern', { id: p, width: 20, height: 16, patternUnits: 'userSpaceOnUse' }, Ln(0, 15, 20, 15, m.d, 2, { 'stroke-opacity': 0.5 })) +
          R(66, 98, 268, 206, m.b, 26) +
          R(66, 98, 268, 206, `url(#${p})`, 26, NS) +
          R(86, 118, 228, 166, 'none', 16, { stroke: m.d, 'stroke-width': 3, 'stroke-opacity': 0.5 }) +
          R(168, 126, 64, 18, m.d, 9) +
          slice(246, 238, 30) +
          slice(298, 214, 24) +
          slice(148, 244, 24) +
          C(110, 148, 4, a.b, NS),
      );
    },
  },

  skillet: {
    focus: [180, 210],
    zoom: 2.2,
    top: 92,
    base: 318,
    shadow: 150,
    draw: ({ m }) =>
      R(268, 188, 108, 34, m.d, 17) +
      C(358, 205, 7, m.l) +
      R(44, 192, 40, 26, m.d, 12) +
      C(168, 205, 112, m.d) +
      C(168, 205, 94, m.b) +
      C(168, 205, 78, m.l, { ...NS, opacity: 0.28 }) +
      P('M138 186 q32 -28 66 -2 q26 24 -8 48 q-34 22 -62 -6 q-18 -22 4 -40Z', N.white) +
      C(170, 210, 17, N.glow) +
      C(164, 204, 5, N.white, { ...NS, opacity: 0.8 }) +
      S('M90 150 A92 92 0 0 1 140 112', N.white, 6, { 'stroke-opacity': 0.35 }),
  },

  rug: {
    focus: [200, 226],
    zoom: 1.9,
    top: 122,
    base: 324,
    shadow: 0,
    draw: ({ m, a }) => {
      let top = '';
      for (let x = 100; x <= 300; x += 14) top += `M${x} 138v-14`;
      let bottom = '';
      for (let x = 34; x <= 366; x += 18) bottom += `M${x} 306v18`;
      return (
        S(top, m.d, 3.5) +
        S(bottom, m.d, 3.5) +
        P('M96 138 H304 L372 306 H28Z', m.b) +
        P('M110 150 H290 L350 294 H50Z', 'none', { stroke: m.d, 'stroke-width': 3, 'stroke-opacity': 0.6 }) +
        P('M124 162 H276 L328 284 H72Z', m.l) +
        Pg([[200, 176], [264, 226], [200, 278], [136, 226]], a.b) +
        Pg([[200, 198], [238, 226], [200, 258], [162, 226]], m.b) +
        Pg([[200, 214], [216, 226], [200, 240], [184, 226]], a.b, NS) +
        Pg([[146, 188], [162, 202], [146, 216], [130, 202]], a.b, NS) +
        Pg([[254, 188], [270, 202], [254, 216], [238, 202]], a.b, NS) +
        Pg([[110, 262], [128, 274], [110, 286], [92, 274]], a.b, NS) +
        Pg([[290, 262], [308, 274], [290, 286], [272, 274]], a.b, NS)
      );
    },
  },
};
