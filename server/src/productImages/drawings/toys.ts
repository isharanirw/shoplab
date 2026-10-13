import { N } from '../colours';
import { C, E, Ln, P, Pg, R, S, el, star, tf, tube, NS } from '../svg';
import type { Motif } from '../types';

const BLUE = '#4a90e2';
const YELLOW = '#f5c845';
const GREEN = '#4fae6e';
const PURPLE = '#8e6bd1';
const RED = '#e5484d';

/** A line with a knob on it, like the cut between two jigsaw pieces. */
function cut(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const vertical = x1 === x2;
  const knob = vertical ? `M${x1} ${my - 10} a10 10 0 1 ${(x1 + y1) % 2 ? 0 : 1} 0 20` : `M${mx - 10} ${y1} a10 10 0 1 ${(x1 + y1) % 2 ? 1 : 0} 20 0`;
  return `M${x1} ${y1}L${vertical ? x1 : mx - 10} ${vertical ? my - 10 : y1}${knob}M${vertical ? x1 : mx + 10} ${vertical ? my + 10 : y1}L${x2} ${y2}`;
}

export const toys: Record<string, Motif> = {
  blocks: {
    focus: [200, 240],
    zoom: 1.9,
    top: 118,
    base: 320,
    shadow: 150,
    draw: ({ m, a }) =>
      R(80, 240, 80, 80, m.b, 6) +
      C(120, 280, 14, N.white, NS) +
      R(168, 240, 66, 80, BLUE, 4) +
      E(201, 240, 33, 10, '#82b6ee') +
      R(240, 240, 80, 80, YELLOW, 6) +
      R(256, 256, 48, 48, 'none', 4, { stroke: '#c79b13', 'stroke-width': 3, 'stroke-opacity': 0.8 }) +
      P('M96 240 A44 44 0 0 1 184 240Z', GREEN) +
      R(196, 176, 100, 64, a.b, 6) +
      Pg([[206, 176], [286, 176], [246, 118]], PURPLE) +
      C(152, 218, 6, N.white, NS) +
      C(120, 218, 6, N.white, NS),
  },

  rcCar: {
    focus: [250, 214],
    zoom: 2,
    top: 88,
    base: 362,
    shadow: 130,
    draw: ({ m, a }) => {
      const wheel = (cx: number) => C(cx, 262, 36, N.darker) + C(cx, 262, 20, N.steel) + C(cx, 262, 7, m.d, NS);
      return (
        el(
          'g',
          { transform: tf(0, -30) },
          Ln(130, 190, 108, 112, N.darker, 3) +
            C(108, 110, 6, a.b) +
            wheel(112) +
            wheel(292) +
            P('M50 252 L70 214 Q110 206 140 190 L200 176 Q250 176 276 206 L330 214 Q356 220 352 252Z', m.b) +
            P('M150 198 L196 184 Q232 184 252 208 L170 210Z', N.glass) +
            S('M58 238 H342', a.b, 8, { 'stroke-linecap': 'butt' }) +
            C(214, 232, 12, N.white) +
            Pg([[322, 214], [362, 194], [370, 204], [332, 224]], a.b) +
            wheel(112) +
            wheel(292),
        ) +
        R(130, 312, 140, 52, N.dark, 24) +
        Ln(176, 312, 176, 296, N.darker, 3) +
        C(172, 338, 12, a.b) +
        C(228, 338, 12, a.b) +
        R(190, 328, 20, 8, N.steel, 3)
      );
    },
  },

  jigsaw: {
    focus: [200, 200],
    zoom: 1.9,
    top: 86,
    base: 366,
    shadow: 0,
    draw: (l) => {
      const { m, a } = l;
      const clip = l.id('j');
      let cuts = '';
      for (const p of [145, 200, 255]) {
        cuts += cut(p, 90, p, 145) + cut(p, 145, p, 200) + cut(p, 200, p, 255) + cut(p, 255, p, 310);
        cuts += cut(90, p, 145, p) + cut(145, p, 200, p) + cut(200, p, 255, p) + cut(255, p, 310, p);
      }
      return (
        el('clipPath', { id: clip }, R(90, 90, 220, 220, '#000', 6, NS)) +
        R(90, 90, 220, 220, '#8ecdf0') +
        el(
          'g',
          { 'clip-path': `url(#${clip})`, stroke: 'none' },
          C(150, 140, 24, N.glow) +
            P('M90 250 Q150 190 220 250 T310 230 V310 H90Z', m.b) +
            P('M90 280 Q170 240 250 284 T310 270 V310 H90Z', a.b) +
            R(244, 176, 10, 50, '#8d5c3c') +
            C(249, 168, 28, GREEN) +
            R(255, 90, 55, 55, '#c9d3dd'),
        ) +
        S(cuts, N.white, 3, { 'stroke-opacity': 0.95 }) +
        R(90, 90, 220, 220, 'none', 6) +
        el(
          'g',
          { transform: tf(338, 322, 14, 1, 0, 0) },
          R(-30, -30, 60, 60, '#8ecdf0') + C(-30, 0, 11, '#8ecdf0') + C(0, -30, 11, '#8ecdf0') + C(30, 0, 11, N.white) + C(0, 30, 11, N.white) + C(18, -14, 9, N.glow, NS),
        )
      );
    },
  },

  teddy: {
    focus: [200, 135],
    zoom: 2.3,
    top: 58,
    base: 338,
    shadow: 100,
    draw: ({ m, a }) =>
      E(150, 316, 34, 24, m.b) +
      E(250, 316, 34, 24, m.b) +
      E(150, 322, 20, 13, m.l, NS) +
      E(250, 322, 20, 13, m.l, NS) +
      E(200, 262, 74, 80, m.b) +
      E(200, 272, 44, 54, m.l, NS) +
      el('g', { transform: tf(0, 0, -18, 1, 140, 230) }, E(138, 230, 22, 44, m.b)) +
      el('g', { transform: tf(0, 0, 18, 1, 262, 230) }, E(262, 230, 22, 44, m.b)) +
      C(138, 98, 25, m.b) +
      C(262, 98, 25, m.b) +
      C(138, 98, 12, m.l, NS) +
      C(262, 98, 12, m.l, NS) +
      C(200, 134, 70, m.b) +
      E(200, 156, 30, 24, m.l) +
      E(200, 146, 11, 8, N.darker, NS) +
      S('M200 154 V164 M188 168 Q200 178 212 168', N.darker, 3) +
      C(174, 120, 6.5, N.darker, NS) +
      C(226, 120, 6.5, N.darker, NS) +
      C(176, 118, 2, N.white, NS) +
      C(228, 118, 2, N.white, NS) +
      Pg([[200, 204], [166, 188], [166, 220]], a.b) +
      Pg([[200, 204], [234, 188], [234, 220]], a.b) +
      C(200, 204, 8, a.d),
  },

  boardGame: {
    focus: [200, 200],
    zoom: 1.9,
    top: 64,
    base: 336,
    shadow: 0,
    draw: ({ m, a }) => {
      const colours = [a.b, N.glow, '#7bc6cc', N.white, '#e76f51'];
      let cells = '';
      let n = 0;
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          if (i > 0 && i < 7 && j > 0 && j < 7) continue;
          cells += R(80 + i * 30, 80 + j * 30, 30, 30, colours[n % colours.length]!, 0);
          n++;
        }
      }
      const pawn = (x: number, y: number, c: string) => E(x, y + 6, 8, 3, '#1f2a44', { ...NS, opacity: 0.3 }) + P(`M${x - 8} ${y + 4} Q${x} ${y - 14} ${x + 8} ${y + 4}Z`, c) + C(x, y - 12, 6, c);
      const die = (x: number, y: number, rot: number, pips: [number, number][]) =>
        el('g', { transform: tf(x, y, rot) }, R(-17, -17, 34, 34, N.white, 6) + pips.map(([px, py]) => C(px, py, 3.2, N.darker, NS)).join(''));
      return (
        R(62, 62, 276, 276, m.b, 14) +
        cells +
        R(110, 110, 180, 180, m.l, 8) +
        star(200, 166, 30, a.b) +
        die(160, 242, -12, [[-8, -8], [8, 8], [0, 0]]) +
        die(220, 246, 14, [[-8, -8], [8, -8], [-8, 8], [8, 8]]) +
        pawn(94, 292, RED) +
        pawn(306, 104, BLUE) +
        pawn(94, 140, GREEN) +
        pawn(270, 308, YELLOW)
      );
    },
  },

  craftKit: {
    focus: [190, 200],
    zoom: 1.7,
    top: 84,
    base: 332,
    shadow: 0,
    draw: () => {
      const brush = (x: number, y: number, rot: number, tip: string) =>
        el('g', { transform: tf(x, y, rot) }, R(0, -5, 96, 10, N.wood, 5) + R(96, -6, 22, 12, N.steel, 2) + P('M118 -6 Q154 -2 158 0 Q154 2 118 6Z', tip));
      const crayon = (x: number, y: number, c: string) =>
        el('g', { transform: tf(x, y, -10) }, R(0, 0, 84, 18, c, 3) + Pg([[84, 0], [104, 9], [84, 18]], c) + R(18, 0, 20, 18, N.white, 0, { opacity: 0.8 }));
      return (
        P('M72 214 C62 124 156 78 250 98 C342 116 354 198 296 232 C256 254 236 226 210 246 C184 266 106 290 72 214Z', N.wood) +
        C(120, 170, 17, RED) +
        C(166, 128, 17, YELLOW) +
        C(222, 120, 17, BLUE) +
        C(278, 148, 17, GREEN) +
        C(302, 198, 15, PURPLE) +
        E(166, 224, 17, 13, '#f3e6cc') +
        brush(182, 318, -34, RED) +
        brush(140, 330, -12, BLUE) +
        crayon(50, 302, YELLOW) +
        crayon(60, 330, GREEN)
      );
    },
  },

  trainSet: {
    focus: [170, 205],
    zoom: 1.7,
    top: 128,
    base: 318,
    shadow: 0,
    draw: ({ m, a }) => {
      let sleepers = '';
      for (let x = 24; x < 390; x += 34) sleepers += R(x, 302, 18, 14, N.woodDark, 2, NS);
      const wheel = (cx: number, cy: number, r: number) => C(cx, cy, r, N.darker) + C(cx, cy, r * 0.55, N.steel) + C(cx, cy, 3, N.darker, NS);
      return (
        sleepers +
        Ln(14, 302, 386, 302, N.steelDark, 6, { 'stroke-opacity': 1 }) +
        R(288, 206, 96, 64, a.b, 6) +
        R(284, 200, 104, 10, a.d, 3) +
        R(300, 224, 26, 22, N.glass, 3) +
        R(346, 224, 26, 22, N.glass, 3) +
        wheel(318, 284, 16) +
        wheel(358, 284, 16) +
        R(214, 128, 30, 48, N.dark, 5) +
        R(208, 122, 42, 12, N.darker, 5) +
        R(100, 170, 170, 70, m.b, 30) +
        R(60, 140, 76, 120, m.d, 8) +
        R(52, 130, 92, 14, N.darker, 5) +
        R(76, 160, 34, 40, N.glass, 4) +
        C(270, 206, 10, N.glow) +
        S('M150 206 H262', N.white, 6, { 'stroke-linecap': 'butt', 'stroke-opacity': 0.9 }) +
        Pg([[270, 262], [300, 296], [250, 296]], a.b) +
        wheel(100, 274, 28) +
        wheel(182, 280, 22) +
        wheel(236, 280, 22) +
        Ln(100, 274, 236, 280, N.steelDark, 5) +
        C(100, 274, 6, N.steel)
      );
    },
  },

  scienceKit: {
    focus: [160, 230],
    zoom: 2,
    top: 80,
    base: 312,
    shadow: 120,
    draw: ({ m, a }) => {
      const tubeAt = (x: number, c: string, level: number) =>
        R(x - 11, 170, 22, 106, N.glass, 11, { 'fill-opacity': 0.7 }) + P(`M${x - 11} ${level} H${x + 11} V265 a11 11 0 0 1 -22 0Z`, c);
      const atom = el('g', { transform: tf(322, 116) }, [0, 60, 120].map((r) => el('g', { transform: tf(0, 0, r) }, E(0, 0, 32, 11, 'none', { stroke: a.b, 'stroke-width': 3, 'stroke-opacity': 1 }))).join('') + C(0, 0, 6, a.b, NS));
      return (
        atom +
        R(246, 276, 112, 14, N.wood, 4) +
        tubeAt(270, m.b, 226) +
        tubeAt(302, a.b, 206) +
        tubeAt(334, PURPLE, 240) +
        P('M128 90 V162 L66 286 Q56 314 90 314 H210 Q244 314 234 286 L172 162 V90Z', N.glass, { 'fill-opacity': 0.75 }) +
        P('M82 254 H218 L234 286 Q244 314 210 314 H90 Q56 314 66 286Z', m.b, NS) +
        R(120, 82, 60, 12, N.steel, 5) +
        C(122, 280, 7, N.white, { ...NS, opacity: 0.8 }) +
        C(156, 262, 5, N.white, { ...NS, opacity: 0.8 }) +
        C(178, 290, 8, N.white, { ...NS, opacity: 0.8 }) +
        C(150, 196, 4, m.b, NS) +
        C(160, 170, 3, m.b, NS)
      );
    },
  },

  drawingBoard: {
    focus: [200, 180],
    zoom: 2,
    top: 68,
    base: 322,
    shadow: 110,
    draw: ({ m, a }) =>
      R(84, 68, 232, 254, m.b, 20) +
      R(104, 90, 192, 178, '#c9d1d9', 10) +
      C(200, 178, 50, 'none', { stroke: N.darker, 'stroke-width': 4, 'stroke-opacity': 1 }) +
      C(184, 166, 5, N.darker, NS) +
      C(216, 166, 5, N.darker, NS) +
      S('M176 194 Q200 218 224 194', N.darker, 4) +
      S('M122 120 l10 -14 l10 14 l-18 -9 l16 0 z', N.darker, 2.5) +
      S('M262 236 q12 -10 24 0 t0 12', N.darker, 3) +
      C(130, 296, 13, N.white) +
      C(270, 296, 13, N.white) +
      R(172, 284, 56, 22, a.b, 8) +
      S('M300 262 Q336 308 344 292', N.darker, 2.5) +
      el('g', { transform: tf(346, 246, 18) }, R(-8, -2, 16, 78, a.b, 6) + Pg([[-8, 76], [8, 76], [0, 92]], N.darker)),
  },

  dinosaur: {
    focus: [320, 150],
    zoom: 2.3,
    top: 104,
    base: 336,
    shadow: 130,
    draw: ({ m, a }) =>
      Pg([[140, 176], [158, 148], [176, 170]], a.b) +
      Pg([[176, 166], [196, 136], [214, 164]], a.b) +
      Pg([[214, 168], [234, 140], [250, 170]], a.b) +
      tube('M112 232 Q62 252 38 298', 40, m.b) +
      R(180, 262, 44, 66, m.b, 18) +
      R(112, 268, 46, 60, m.b, 18) +
      E(206, 326, 30, 12, m.l) +
      E(136, 326, 30, 12, m.l) +
      E(190, 228, 104, 72, m.b) +
      E(198, 256, 66, 38, m.l, NS) +
      tube('M250 210 Q274 160 300 150', 52, m.b) +
      E(320, 146, 50, 38, m.b) +
      C(332, 130, 7, N.darker, NS) +
      C(334, 128, 2.5, N.white, NS) +
      C(362, 142, 3.5, N.darker, NS) +
      S('M318 164 Q340 174 360 162', N.darker, 3) +
      S('M150 214 l8 8 M170 200 l8 8 M190 196 l8 8', m.l, 3) +
      S('M120 296 l8 -6 M140 300 l8 -6', m.d, 2.5, { 'stroke-opacity': 0.7 }),
  },
};
