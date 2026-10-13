import type { Tone } from './colours';

/** What a motif needs to draw itself: its two colours and a way to get ids that are unique inside one SVG file. */
export interface Look {
  /** Main colour of the product. */
  m: Tone;
  /** Accent colour. */
  a: Tone;
  /** Prefix that keeps ids (patterns, clip paths) unique when the same motif is drawn more than once in a file. */
  u: string;
  id(name: string): string;
}

export type SceneKind = 'desk' | 'room' | 'wardrobe' | 'shelf' | 'outdoor' | 'play';

/**
 * One drawn object. `draw` returns SVG markup in a 400 x 400 box with the object centred. The composer places it
 * three ways: as is, zoomed on `focus` inside a lens, and smaller in a scene in another colour.
 */
export interface Motif {
  draw(l: Look): string;
  /** Centre of the close-up, in drawing coordinates. */
  focus: [number, number];
  /** Zoom factor of the close-up (default 2). */
  zoom?: number;
  /** Highest y of the drawing (default 70). */
  top?: number;
  /** Lowest y of the drawing, where it rests on the ground (default 320). */
  base?: number;
  /** Half width of the floor shadow; 0 for flat things that lie on a surface. */
  shadow?: number;
  /** Clothes hang from a rail in the scene. */
  hang?: boolean;
  /** Which scene the third picture uses (default depends on the category). */
  scene?: SceneKind;
  /** Draw smaller copies in other colours behind the main one in the third picture (default true). */
  copies?: boolean;
  /** Scale of the object in the third picture (default 0.72). */
  sceneScale?: number;
  /** Full custom content for the third picture, including the scene (ctx.bg). */
  view3?: (alt: Look, ctx: SceneContext) => string;
}

export interface SceneContext {
  theme: { bg: string; bg2: string; deep: string };
  /** Builds a Look for another colour name, with a fresh id prefix. */
  look(colour: string, u: string): Look;
  /** The product ID, for small deterministic variations. */
  seed: number;
  mainColour: string;
  altColour: string;
  /** The scene behind the object (wall, shelf, floor...) and the y where things stand. */
  bg: string;
  ground: number;
}
