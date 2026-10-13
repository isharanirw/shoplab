import { N } from '../colours';
import { C, E, P, Pg, R, S, el, tf, tube, NS } from '../svg';
import type { Attrs } from '../svg';
import type { Motif } from '../types';

const G_ = (inner: string, transform: string, o: Attrs = {}) => el('g', { transform, ...o }, inner);

function wifi(cx: number, cy: number, colour: string, scale = 1): string {
  const arcs = [18, 32, 46].map((r) => {
    const k = r * scale * 0.72;
    return S(`M${cx - k} ${cy - k} A${r * scale} ${r * scale} 0 0 1 ${cx + k} ${cy - k}`, colour, 6);
  });
  return C(cx, cy, 6 * scale, colour, NS) + arcs.join('');
}

export const electronics: Record<string, Motif> = {
  headphones: {
    focus: [97, 255],
    zoom: 2.3,
    top: 90,
    base: 312,
    shadow: 110,
    draw: ({ m, a }) =>
      tube('M96 240 C96 88 304 88 304 240', 22, m.b) +
      S('M132 150 Q200 104 268 150', N.dark, 12) +
      R(88, 190, 18, 26, N.steel, 4) +
      R(294, 190, 18, 26, N.steel, 4) +
      R(64, 204, 66, 112, m.b, 28) +
      R(270, 204, 66, 112, m.b, 28) +
      R(116, 218, 28, 84, N.dark, 14) +
      R(256, 218, 28, 84, N.dark, 14) +
      C(95, 260, 17, a.b) +
      C(95, 260, 7, m.d, NS) +
      C(305, 260, 17, a.b) +
      C(305, 260, 7, m.d, NS),
  },

  speaker: {
    focus: [200, 205],
    zoom: 2.4,
    top: 96,
    base: 284,
    shadow: 140,
    draw: (l) => {
      const { m, a } = l;
      const g = l.id('g');
      return (
        S('M130 140 C130 90 270 90 270 140', N.dark, 8) +
        R(70, 132, 260, 152, m.b, 60) +
        el('pattern', { id: g, width: 14, height: 14, patternUnits: 'userSpaceOnUse' }, C(7, 7, 3.2, m.d, NS)) +
        R(100, 156, 200, 104, `url(#${g})`, 40, { stroke: 'none' }) +
        R(100, 156, 200, 104, 'none', 40) +
        R(70, 176, 22, 64, a.b, 10) +
        R(308, 176, 22, 64, a.b, 10) +
        R(160, 118, 80, 20, m.d, 10) +
        C(182, 128, 5, N.white, NS) +
        C(200, 128, 5, N.white, NS) +
        C(218, 128, 5, a.b, NS)
      );
    },
  },

  charger: {
    focus: [200, 200],
    zoom: 2.2,
    top: 40,
    base: 316,
    shadow: 90,
    draw: ({ m, a }) =>
      tube('M200 98 C200 60 250 70 288 40', 10, N.dark) +
      R(172, 88, 56, 48, N.steel, 8) +
      R(126, 128, 148, 156, m.b, 22) +
      R(142, 144, 116, 124, m.l, 14, { 'fill-opacity': 0.5, stroke: 'none' }) +
      R(156, 176, 88, 28, N.dark, 14) +
      R(168, 186, 64, 8, N.steel, 4, NS) +
      C(200, 236, 6, a.b, NS) +
      R(164, 284, 16, 34, N.steel, 3) +
      R(220, 284, 16, 34, N.steel, 3),
  },

  deskLamp: {
    focus: [228, 150],
    zoom: 2.2,
    top: 90,
    base: 318,
    shadow: 90,
    draw: ({ m, a }) =>
      wifi(92, 142, a.b, 0.9) +
      G_(Pg([[34, -20], [170, -64], [170, 64], [34, 20]], N.glow, { ...NS, opacity: 0.45 }), tf(228, 152, 48)) +
      tube('M148 296 L128 204 L222 146', 12, m.d) +
      E(148, 308, 66, 15, m.d) +
      E(148, 300, 66, 15, m.b) +
      C(128, 204, 11, N.steel) +
      C(148, 296, 9, N.steel) +
      G_(R(-34, -28, 74, 56, m.b, 26) + E(38, 0, 8, 22, N.glow, NS), tf(222, 146, 48)),
  },

  keyboard: {
    focus: [120, 170],
    zoom: 2.6,
    top: 118,
    base: 282,
    shadow: 150,
    draw: (l) => {
      const { m, a } = l;
      const k = l.id('k');
      return (
        R(44, 120, 312, 164, m.d, 20) +
        R(44, 258, 312, 26, m.b, 12) +
        el('pattern', { id: k, width: 21, height: 24, patternUnits: 'userSpaceOnUse', x: 62, y: 134 }, R(1.5, 2, 18, 20, m.l, 4, { stroke: 'none' })) +
        R(62, 134, 273, 96, `url(#${k})`, 0, NS) +
        R(62, 134, 18, 20, a.b, 4) +
        R(293, 182, 40, 20, a.b, 4) +
        R(62, 232, 54, 21, m.l, 4) +
        R(120, 232, 138, 21, m.l, 4) +
        R(262, 232, 36, 21, m.l, 4) +
        R(301, 232, 34, 21, m.l, 4)
      );
    },
  },

  mouse: {
    focus: [200, 150],
    zoom: 2.3,
    top: 88,
    base: 332,
    shadow: 100,
    draw: ({ m, a }) =>
      P('M200 90 C272 90 302 160 294 240 C287 310 252 332 200 332 C148 332 113 310 106 240 C98 160 128 90 200 90Z', m.b) +
      S('M200 94 V196', m.d, 3) +
      S('M110 196 Q200 220 290 196', m.d, 3) +
      R(187, 124, 26, 48, N.dark, 13) +
      R(196, 132, 8, 32, a.b, 4, NS) +
      P('M250 118 C282 150 292 200 288 250', 'none', { stroke: m.l, 'stroke-width': 6, 'stroke-opacity': 0.8, 'stroke-linecap': 'round' }) +
      R(306, 292, 38, 18, N.dark, 4) +
      R(344, 296, 12, 10, N.steel, 2),
  },

  actionCamera: {
    focus: [190, 198],
    zoom: 2.3,
    top: 104,
    base: 318,
    shadow: 110,
    draw: ({ m, a }) =>
      R(118, 100, 44, 18, a.b, 6) +
      R(164, 266, 72, 14, m.d, 4) +
      R(180, 278, 40, 36, a.b, 5) +
      C(200, 296, 6, m.d, NS) +
      R(88, 114, 224, 156, m.b, 30) +
      C(190, 192, 58, m.d) +
      C(190, 192, 47, N.steel) +
      C(190, 192, 37, '#1b3a63') +
      C(190, 192, 21, '#2f6db0', NS) +
      C(180, 181, 8, N.white, { ...NS, opacity: 0.85 }) +
      R(254, 134, 42, 32, N.darker, 7) +
      C(275, 150, 6, N.leaf, NS) +
      C(268, 232, 8, N.white, NS) +
      C(268, 232, 5, '#e5484d', NS),
  },

  powerBank: {
    focus: [200, 175],
    zoom: 2,
    top: 76,
    base: 322,
    shadow: 90,
    draw: ({ m, a }) =>
      R(118, 76, 164, 246, m.b, 28) +
      R(146, 102, 18, 9, a.b, 3, NS) +
      R(174, 102, 18, 9, a.b, 3, NS) +
      R(202, 102, 18, 9, a.b, 3, NS) +
      R(230, 102, 18, 9, m.l, 3, NS) +
      Pg([[214, 148], [176, 200], [198, 200], [186, 246], [226, 190], [204, 190]], N.white) +
      R(146, 280, 44, 18, N.dark, 7) +
      R(210, 280, 44, 18, N.dark, 7) +
      R(154, 287, 28, 4, N.steel, 2, NS) +
      R(218, 287, 28, 4, N.steel, 2, NS),
  },

  phoneCase: {
    focus: [170, 116],
    zoom: 2.3,
    top: 58,
    base: 360,
    shadow: 80,
    draw: ({ m, a }) =>
      R(114, 118, 7, 36, m.d, 3) +
      R(114, 166, 7, 36, m.d, 3) +
      R(279, 150, 7, 52, m.d, 3) +
      R(120, 58, 160, 302, m.b, 36) +
      R(130, 68, 140, 282, 'none', 28, { stroke: m.l, 'stroke-opacity': 0.55, 'stroke-width': 3 }) +
      R(138, 78, 78, 80, N.darker, 22) +
      C(160, 101, 16, m.d) +
      C(160, 101, 9, '#2d5b8f', NS) +
      C(160, 136, 16, m.d) +
      C(160, 136, 9, '#2d5b8f', NS) +
      C(196, 98, 7, N.glow, NS) +
      C(196, 126, 4, N.steel, NS) +
      C(200, 264, 20, a.b, { ...NS, opacity: 0.9 }) +
      C(200, 264, 11, m.b, NS),
  },

  curvedMonitor: {
    focus: [282, 196],
    zoom: 2.1,
    top: 108,
    base: 336,
    shadow: 120,
    copies: false,
    sceneScale: 0.8,
    draw: (l) => {
      const { m, a } = l;
      const clip = l.id('s');
      const screen = 'M50 126 Q200 162 350 126 L350 238 Q200 274 50 238Z';
      return (
        P('M186 262 H214 L220 322 H180Z', m.d) +
        P('M120 332 Q200 306 280 332 Q200 346 120 332Z', m.d) +
        P('M34 112 Q200 152 366 112 L366 252 Q200 292 34 252Z', N.darker) +
        el('clipPath', { id: clip }, P(screen, '#000', NS)) +
        P(screen, '#16355c', NS) +
        el(
          'g',
          { 'clip-path': `url(#${clip})`, stroke: 'none' },
          R(40, 120, 330, 70, '#2c5f9e') +
            C(292, 168, 16, N.glow) +
            Pg([[40, 260], [40, 200], [100, 164], [150, 206], [210, 170], [270, 220], [330, 188], [370, 214], [370, 260]], a.b) +
            Pg([[40, 260], [40, 232], [96, 206], [160, 240], [230, 216], [300, 244], [370, 232], [370, 260]], m.d),
        ) +
        P(screen, 'none', { stroke: N.steel, 'stroke-width': 3, 'stroke-opacity': 1 }) +
        C(200, 275, 3.5, a.b, NS) +
        S('M70 140 Q120 150 150 148', N.white, 5, { 'stroke-opacity': 0.35 })
      );
    },
  },
};
