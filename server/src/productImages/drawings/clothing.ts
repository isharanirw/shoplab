import { N } from '../colours';
import type { Tone } from '../colours';
import { C, E, Ln, P, Pg, R, S, el, tf, tube, NS } from '../svg';
import type { Motif } from '../types';

const STITCH = '#f0b25a';

function stitch(d: string, w = 2): string {
  return S(d, STITCH, w, { 'stroke-dasharray': '6 4' });
}

function fringe(x0: number, x1: number, y: number, len: number, step: number, colour: string, dir = 1): string {
  let d = '';
  for (let x = x0; x <= x1; x += step) d += `M${x} ${y}v${len * dir}`;
  return S(d, colour, 3.5);
}

function sock(x: number, y: number, rot: number, body: Tone, band: string, toe: string): string {
  return el(
    'g',
    { transform: tf(x, y, rot, 0.72, 0, 0) },
    P('M0 0 H46 V84 Q46 108 70 116 Q96 126 94 152 Q92 170 68 170 H24 Q-2 170 -2 142Z', body.b) +
      R(0, 0, 46, 18, band, 3) +
      R(0, 32, 46, 7, band, 0, NS) +
      P('M24 170 Q-2 170 -2 142 L0 130 Q14 128 20 144Z', toe, NS) +
      P('M68 170 Q92 170 94 152 Q95 138 84 130 Q74 150 68 170Z', toe, NS),
  );
}

export const clothing: Record<string, Motif> = {
  tshirt: {
    focus: [200, 112],
    zoom: 2.4,
    top: 80,
    base: 330,
    shadow: 0,
    hang: true,
    draw: ({ m, a }) =>
      P('M130 80 L85 108 L48 168 L92 196 L122 164 L122 330 L278 330 L278 164 L308 196 L352 168 L315 108 L270 80 Q238 108 200 108 Q162 108 130 80Z', m.b) +
      P('M132 82 Q165 130 200 130 Q235 130 268 82 Q238 108 200 108 Q162 108 132 82Z', m.d) +
      S('M134 86 Q165 134 200 134 Q235 134 266 86', m.l, 8, { 'stroke-opacity': 0.9 }) +
      Pg([[122, 330], [158, 330], [140, 190]], m.d, { ...NS, opacity: 0.12 }) +
      S('M56 170 L98 198', m.d, 3, { 'stroke-dasharray': '5 4' }) +
      S('M344 170 L302 198', m.d, 3, { 'stroke-dasharray': '5 4' }) +
      C(200, 226, 26, a.b) +
      C(200, 226, 12, m.b, NS),
  },

  jeans: {
    focus: [200, 104],
    zoom: 2.6,
    top: 56,
    base: 334,
    shadow: 0,
    hang: true,
    draw: ({ m }) =>
      P('M122 64 H278 L292 334 H208 L200 162 L192 334 H108Z', m.b) +
      E(150, 240, 22, 44, m.l, { ...NS, opacity: 0.3 }) +
      E(250, 240, 22, 44, m.l, { ...NS, opacity: 0.3 }) +
      R(120, 60, 160, 26, m.d, 4) +
      R(138, 54, 10, 34, m.d, 3) +
      R(176, 54, 10, 34, m.d, 3) +
      R(214, 54, 10, 34, m.d, 3) +
      R(252, 54, 10, 34, m.d, 3) +
      S('M126 88 Q148 152 192 100', m.d, 3) +
      S('M274 88 Q252 152 208 100', m.d, 3) +
      stitch('M128 90 Q150 148 190 102') +
      stitch('M272 90 Q250 148 210 102') +
      S('M200 88 V162', m.d, 3) +
      stitch('M205 90 V158') +
      C(200, 74, 6, N.steel) +
      S('M110 318 H190', m.d, 3) +
      S('M210 318 H290', m.d, 3),
  },

  hoodie: {
    focus: [200, 116],
    zoom: 2.3,
    top: 42,
    base: 334,
    shadow: 0,
    hang: true,
    draw: ({ m, a }) =>
      P('M142 118 L98 140 L58 306 L102 316 L132 214 L130 334 L270 334 L268 214 L298 316 L342 306 L302 140 L258 118Z', m.b) +
      P('M58 306 L102 316 L98 332 L54 322Z', m.d) +
      P('M342 306 L298 316 L302 332 L346 322Z', m.d) +
      R(130, 320, 140, 16, m.d, 3) +
      P('M138 124 Q148 40 200 42 Q252 40 262 124 Q232 160 200 160 Q168 160 138 124Z', m.b) +
      P('M160 120 Q164 70 200 68 Q236 70 240 120 Q220 146 200 146 Q180 146 160 120Z', m.d) +
      Ln(186, 150, 182, 214, N.white, 4) +
      Ln(214, 150, 218, 214, N.white, 4) +
      C(182, 218, 4.5, a.b) +
      C(218, 218, 4.5, a.b) +
      P('M146 262 H254 L270 318 H130Z', m.d) +
      S('M146 266 L166 300', m.l, 3, { 'stroke-opacity': 0.8 }) +
      S('M254 266 L234 300', m.l, 3, { 'stroke-opacity': 0.8 }),
  },

  belt: {
    focus: [74, 200],
    zoom: 2.4,
    top: 150,
    base: 258,
    shadow: 140,
    sceneScale: 0.8,
    copies: false,
    draw: ({ m }) => {
      let holes = '';
      for (const x of [186, 220, 254, 288]) holes += C(x, 200, 7, m.d, NS);
      return el(
        'g',
        { transform: tf(0, 0, -8, 1, 200, 200) },
        P('M70 164 H322 L368 200 L322 236 H70Z', m.b) +
          stitch('M72 174 H318', 2.5) +
          stitch('M72 226 H318', 2.5) +
          holes +
          R(262, 158, 16, 84, m.d, 3) +
          R(40, 156, 70, 88, 'none', 14, { stroke: N.steel, 'stroke-width': 11, 'stroke-opacity': 1 }) +
          R(66, 150, 8, 100, N.steel, 3) +
          R(70, 196, 66, 9, N.steelDark, 4),
      );
    },
  },

  scarf: {
    focus: [140, 290],
    zoom: 2.4,
    top: 66,
    base: 338,
    shadow: 120,
    sceneScale: 0.72,
    draw: ({ m, a }) => {
      const L = (y: number) => [108 - (8 * (y - 130)) / 188, 172 + (8 * (y - 130)) / 188] as const;
      const Rr = (y: number) => [205 + (9 * (y - 124)) / 194, 270 + (22 * (y - 124)) / 194] as const;
      const band = (f: (y: number) => readonly [number, number], y1: number, y2: number) => {
        const [a1, b1] = f(y1);
        const [a2, b2] = f(y2);
        return Pg([[a1, y1], [b1, y1], [b2, y2], [a2, y2]], a.b, NS);
      };
      return (
        fringe(104, 180, 318, 18, 8, m.d) +
        fringe(214, 292, 318, 18, 9, m.d) +
        P('M108 130 H172 L180 318 H100Z', m.b) +
        P('M205 124 H270 L292 318 H214Z', m.b) +
        band(L, 206, 222) +
        band(L, 246, 262) +
        band(L, 286, 302) +
        band(Rr, 210, 226) +
        band(Rr, 250, 266) +
        band(Rr, 290, 306) +
        tube('M104 134 Q104 70 200 70 Q296 70 296 134', 46, m.b) +
        S('M126 138 Q126 90 200 90 Q274 90 274 138', m.l, 6, { 'stroke-opacity': 0.7 })
      );
    },
  },

  socks: {
    focus: [150, 240],
    zoom: 2.3,
    top: 82,
    base: 316,
    shadow: 140,
    sceneScale: 0.74,
    draw: ({ m, a }) =>
      sock(54, 86, -5, m, a.b, a.d) +
      sock(150, 82, 2, m, a.b, a.d) +
      sock(246, 86, 6, m, a.b, a.d) +
      sock(90, 194, -3, m, a.b, a.d) +
      sock(186, 190, 3, m, a.b, a.d) +
      sock(282, 194, 7, m, a.b, a.d),
  },

  dress: {
    focus: [200, 150],
    zoom: 2.2,
    top: 56,
    base: 346,
    shadow: 0,
    hang: true,
    draw: (l) => {
      const { m, a } = l;
      const d = l.id('d');
      const skirt = 'M126 190 L274 190 Q330 252 346 336 Q200 356 54 336 Q70 252 126 190Z';
      return (
        el('pattern', { id: d, width: 30, height: 30, patternUnits: 'userSpaceOnUse' }, C(8, 8, 4.5, m.l, NS) + C(23, 23, 4.5, m.l, NS)) +
        P('M152 56 L170 56 L177 118 L223 118 L230 56 L248 56 L258 132 L270 172 L274 190 Q330 252 346 336 Q200 356 54 336 Q70 252 126 190 L130 172 L142 132Z', m.b) +
        P(skirt, `url(#${d})`, NS) +
        P('M177 118 Q200 156 223 118Z', m.d) +
        P('M130 172 L270 172 L274 192 L126 192Z', a.b) +
        S('M182 130 L178 170', m.d, 2.5) +
        S('M218 130 L222 170', m.d, 2.5) +
        S('M120 322 Q200 338 280 322', m.d, 3, { 'stroke-opacity': 0.5 })
      );
    },
  },

  denimJacket: {
    focus: [200, 150],
    zoom: 2.3,
    top: 72,
    base: 338,
    shadow: 0,
    hang: true,
    draw: ({ m }) =>
      P('M140 92 L96 112 L56 306 L100 318 L128 196 L128 338 L272 338 L272 196 L300 318 L344 306 L304 112 L260 92Z', m.b) +
      P('M56 306 L100 318 L96 334 L52 322Z', m.d) +
      P('M344 306 L300 318 L304 334 L348 322Z', m.d) +
      R(128, 322, 144, 16, m.d, 3) +
      Ln(200, 130, 200, 322, m.d, 3) +
      Pg([[140, 92], [176, 72], [206, 130], [168, 148]], m.l) +
      Pg([[260, 92], [224, 72], [194, 130], [232, 148]], m.l) +
      R(140, 176, 44, 48, m.b, 4) +
      R(216, 176, 44, 48, m.b, 4) +
      P('M140 176 H184 V194 L162 204 L140 194Z', m.d) +
      P('M216 176 H260 V194 L238 204 L216 194Z', m.d) +
      stitch('M128 200 L128 320') +
      stitch('M272 200 L272 320') +
      stitch('M144 92 L130 190') +
      stitch('M256 92 L270 190') +
      C(200, 232, 5, N.steel) +
      C(200, 266, 5, N.steel) +
      C(200, 300, 5, N.steel) +
      C(162, 197, 4, N.steel) +
      C(238, 197, 4, N.steel),
  },

  oxfordShirt: {
    focus: [200, 132],
    zoom: 2.4,
    top: 84,
    base: 332,
    shadow: 0,
    hang: true,
    draw: (l) => {
      const { m } = l;
      const s = l.id('s');
      const body = 'M138 88 L96 108 L64 246 L102 256 L124 176 L124 332 L276 332 L276 176 L298 256 L336 246 L304 108 L262 88Z';
      return (
        el('pattern', { id: s, width: 12, height: 12, patternUnits: 'userSpaceOnUse' }, Ln(2, 0, 2, 12, m.d, 2.5, { 'stroke-opacity': 0.25 })) +
        P(body, m.b) +
        P(body, `url(#${s})`, NS) +
        P('M64 246 L102 256 L98 278 L58 268Z', m.d) +
        P('M336 246 L298 256 L302 278 L342 268Z', m.d) +
        R(222, 198, 40, 44, m.b, 3) +
        Ln(200, 124, 200, 332, m.d, 3) +
        Pg([[138, 86], [200, 122], [168, 156], [124, 108]], m.l) +
        Pg([[262, 86], [200, 122], [232, 156], [276, 108]], m.l) +
        C(200, 176, 4.5, N.white) +
        C(200, 214, 4.5, N.white) +
        C(200, 252, 4.5, N.white) +
        C(200, 290, 4.5, N.white) +
        C(200, 322, 4.5, N.white)
      );
    },
  },

  pyjamas: {
    focus: [120, 130],
    zoom: 2.3,
    top: 60,
    base: 340,
    shadow: 0,
    sceneScale: 0.76,
    draw: (l) => {
      const { m, a } = l;
      const s = l.id('s');
      const top = 'M96 62 L56 82 L30 172 L64 182 L84 128 L84 208 L202 208 L202 128 L222 182 L256 172 L230 82 L190 62 Q168 82 143 82 Q118 82 96 62Z';
      const pants = 'M170 218 H336 L346 340 H292 L258 270 L224 340 H162Z';
      return (
        P(pants, m.b) +
        P(pants, `url(#${s})`, NS) +
        R(170, 214, 166, 18, a.b, 4) +
        P(top, m.b) +
        P(top, `url(#${s})`, NS) +
        el('pattern', { id: s, width: 20, height: 20, patternUnits: 'userSpaceOnUse' }, R(0, 0, 20, 8, m.d, 0, { ...NS, opacity: 0.35 })) +
        S('M98 64 Q143 118 188 64', a.b, 7) +
        P('M118 138 a20 20 0 1 0 14 34 a16 16 0 1 1 -14 -34Z', N.glow, NS) +
        C(160, 150, 3, N.glow, NS) +
        C(172, 168, 2.5, N.glow, NS) +
        S('M222 232 Q232 258 226 280', N.white, 3)
      );
    },
  },
};
