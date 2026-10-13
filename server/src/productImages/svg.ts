/** Tiny helpers that build SVG markup as strings. Everything is deterministic: numbers are rounded, nothing is random. */

export type Attrs = Record<string, string | number | undefined>;

export function num(v: number): string {
  const r = Math.round(v * 10) / 10;
  return String(r === 0 ? 0 : r);
}

function attrs(a: Attrs): string {
  let out = '';
  for (const [k, v] of Object.entries(a)) {
    if (v === undefined) continue;
    out += ` ${k}="${typeof v === 'number' ? num(v) : v}"`;
  }
  return out;
}

export function el(tag: string, a: Attrs, inner?: string): string {
  return inner === undefined ? `<${tag}${attrs(a)}/>` : `<${tag}${attrs(a)}>${inner}</${tag}>`;
}

/** Rectangle. */
export const R = (x: number, y: number, w: number, h: number, fill: string, rx = 0, o: Attrs = {}) =>
  el('rect', { x, y, width: w, height: h, rx: rx || undefined, fill, ...o });
/** Circle. */
export const C = (cx: number, cy: number, r: number, fill: string, o: Attrs = {}) => el('circle', { cx, cy, r, fill, ...o });
/** Ellipse. */
export const E = (cx: number, cy: number, rx: number, ry: number, fill: string, o: Attrs = {}) => el('ellipse', { cx, cy, rx, ry, fill, ...o });
/** Path. */
export const P = (d: string, fill: string, o: Attrs = {}) => el('path', { d, fill, ...o });
/** Polygon from [x, y] pairs. */
export const Pg = (pts: number[][], fill: string, o: Attrs = {}) =>
  el('polygon', { points: pts.map((p) => `${num(p[0] ?? 0)},${num(p[1] ?? 0)}`).join(' '), fill, ...o });
/** Group with attributes. */
export const G = (inner: string, o: Attrs = {}) => el('g', o, inner);
/** A straight stroke (no fill) that overrides the default outline colour. */
export const Ln = (x1: number, y1: number, x2: number, y2: number, stroke: string, w: number, o: Attrs = {}) =>
  el('line', { x1, y1, x2, y2, stroke, 'stroke-width': w, 'stroke-opacity': 1, ...o });
/** Stroke-only path in a given colour. */
export const S = (d: string, stroke: string, w: number, o: Attrs = {}) =>
  el('path', { d, fill: 'none', stroke, 'stroke-width': w, 'stroke-opacity': 1, ...o });

export const NS: Attrs = { stroke: 'none' };
export const OUTLINE = '#1f2a44';

/** A thick rounded stroke with an outline behind it, for tubes, bands and cables. */
export function tube(d: string, w: number, colour: string, o: Attrs = {}): string {
  return (
    el('path', { d, fill: 'none', stroke: OUTLINE, 'stroke-opacity': 0.5, 'stroke-width': w + 6, ...o }) +
    el('path', { d, fill: 'none', stroke: colour, 'stroke-opacity': 1, 'stroke-width': w, ...o })
  );
}

export function tf(x = 0, y = 0, rot = 0, sc = 1, ox = 0, oy = 0): string {
  // Rotates and scales about (ox, oy), then moves by (x, y).
  const parts: string[] = [];
  if (x !== 0 || y !== 0) parts.push(`translate(${num(x)} ${num(y)})`);
  if (ox !== 0 || oy !== 0) parts.push(`translate(${num(ox)} ${num(oy)})`);
  if (rot !== 0) parts.push(`rotate(${num(rot)})`);
  if (sc !== 1) parts.push(`scale(${num(sc)})`);
  if (ox !== 0 || oy !== 0) parts.push(`translate(${num(-ox)} ${num(-oy)})`);
  return parts.join(' ');
}

/** Points on a regular polygon, starting at the top and going clockwise. */
export function ngon(cx: number, cy: number, r: number, n: number, rotDeg = 0): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < n; i++) {
    const a = ((rotDeg + (360 / n) * i - 90) * Math.PI) / 180;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

/** A small seeded random generator (mulberry32) for scatter such as stars. */
export function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STYLE: Attrs = { stroke: OUTLINE, 'stroke-opacity': 0.5, 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };

/** Wraps drawn markup in the shared flat outline style (soft dark outline on every shape). */
export function styled(inner: string, transform?: string): string {
  return el('g', { ...STYLE, transform: transform || undefined }, inner);
}

/** A five-pointed star. */
export function star(cx: number, cy: number, r: number, fill: string, o: Attrs = {}): string {
  const pts: number[][] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = ((36 * i - 90) * Math.PI) / 180;
    pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]);
  }
  return Pg(pts, fill, o);
}
