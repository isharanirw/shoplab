import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRODUCT_ART } from './catalogue';
import { MAX_SVG_BYTES, VIEW_COUNT, renderView } from './compose';
import { COLOUR_HEX, CATEGORY_THEMES } from './colours';
import { FALLBACK_FILES, renderFallback } from './fallback';
import { productFile } from './generate';
import { MOTIFS } from './library';
import { FALLBACK_SLUGS, ILLUSTRATED_PRODUCT_COUNT, IMAGES_PER_PRODUCT } from '../lib/productImages';

const root = path.resolve(__dirname, '..', '..', '..');
const imagesDir = path.join(root, 'client', 'public', 'images');

interface SeedProduct {
  id: number;
  name: string;
  category: string;
  subcategory: string;
}
interface SeedVariant {
  productId: number;
  colour: string | null;
}

const seedProducts = JSON.parse(fs.readFileSync(path.join(root, 'server', 'seed', 'products.json'), 'utf8')) as SeedProduct[];
const seedVariants = JSON.parse(fs.readFileSync(path.join(root, 'server', 'seed', 'variants.json'), 'utf8')) as SeedVariant[];

/** A small well-formedness check for the SVG files: balanced tags, quoted attributes, a single svg root, unique ids. */
function checkXml(xml: string): string[] {
  const problems: string[] = [];
  const stack: string[] = [];
  const ids = new Set<string>();
  const tag = /<(\/?)([A-Za-z][\w:-]*)((?:\s+[\w:-]+="[^"<]*")*)\s*(\/?)>/g;
  let rest = xml.replace(/^<\?xml[^>]*\?>\s*/, '');
  if (!rest.startsWith('<svg ')) problems.push('does not start with <svg');
  let pos = 0;
  let match: RegExpExecArray | null;
  while ((match = tag.exec(rest)) !== null) {
    const between = rest.slice(pos, match.index);
    if (/[<>]/.test(between)) problems.push(`stray angle bracket near ${between.slice(0, 30)}`);
    pos = match.index + match[0].length;
    const [, closing, name, attrs, selfClosing] = match;
    for (const id of (attrs ?? '').matchAll(/\sid="([^"]+)"/g)) {
      if (ids.has(id[1]!)) problems.push(`duplicate id ${id[1]}`);
      ids.add(id[1]!);
    }
    if (closing) {
      if (stack.pop() !== name) problems.push(`unbalanced </${name}>`);
    } else if (!selfClosing) {
      stack.push(name!);
    }
    if (stack.length === 0 && pos < rest.length - 1 && rest.slice(pos).trim() !== '') problems.push('content after the root element');
  }
  if (stack.length > 0) problems.push(`unclosed: ${stack.join(',')}`);
  rest = rest.trim();
  if (!rest.endsWith('</svg>')) problems.push('does not end with </svg>');
  return problems;
}

describe('the motif library and product mapping', () => {
  it('has one entry for every seeded product id, in order', () => {
    expect(seedProducts).toHaveLength(ILLUSTRATED_PRODUCT_COUNT);
    expect(PRODUCT_ART.map((p) => p.id)).toEqual(seedProducts.map((p) => p.id));
  });

  it('uses the same category as the seed data for every product', () => {
    for (const product of seedProducts) {
      const art = PRODUCT_ART.find((p) => p.id === product.id);
      expect(art?.category, `${product.id} ${product.name}`).toBe(product.category);
    }
  });

  it('covers every seeded category with a colour theme and a fallback illustration', () => {
    const categories = new Set(seedProducts.map((p) => p.category));
    for (const category of categories) {
      expect(CATEGORY_THEMES[category], category).toBeDefined();
      expect(FALLBACK_SLUGS as readonly string[]).toContain(category.toLowerCase());
    }
    expect(FALLBACK_FILES).toContain('general');
  });

  it('only names motifs and colours that exist', () => {
    for (const art of PRODUCT_ART) {
      expect(MOTIFS[art.motif], `product ${art.id}: motif ${art.motif}`).toBeDefined();
      for (const colour of art.colours) expect(COLOUR_HEX[colour], `product ${art.id}: colour ${colour}`).toBeDefined();
    }
  });

  it('gives different products different drawings, and the two Smart Lamps one each that fits their category', () => {
    const lamp = (id: number) => PRODUCT_ART.find((p) => p.id === id)!;
    expect(lamp(4).motif).not.toBe(lamp(23).motif);
    // Every motif is used by exactly one product, so no two products share a drawing.
    const used = PRODUCT_ART.map((p) => p.motif);
    expect(new Set(used).size).toBe(used.length);
    expect(Object.keys(MOTIFS).sort()).toEqual([...used].sort());
  });

  it('takes the colours of a product with colour variants from those variants', () => {
    const alias: Record<string, string[]> = { Blue: ['Blue', 'Denim'] };
    for (const art of PRODUCT_ART) {
      const variantColours = [...new Set(seedVariants.filter((v) => v.productId === art.id && v.colour).map((v) => v.colour as string))];
      if (variantColours.length === 0) continue;
      const allowed = variantColours.flatMap((c) => alias[c] ?? [c]);
      expect(allowed, `product ${art.id} main colour`).toContain(art.colours[0]);
      if (variantColours.length > 1) expect(allowed, `product ${art.id} third-picture colour`).toContain(art.colours[1]);
    }
  });
});

describe('the generated files', () => {
  it('has exactly three files for every product, and they are valid SVG', () => {
    for (const product of seedProducts) {
      const dir = path.join(imagesDir, 'products', String(product.id));
      expect(fs.readdirSync(dir).sort(), `product ${product.id}`).toEqual(['1.svg', '2.svg', '3.svg']);
      expect(IMAGES_PER_PRODUCT).toBe(VIEW_COUNT);
      for (let view = 1; view <= VIEW_COUNT; view++) {
        const xml = fs.readFileSync(path.join(imagesDir, productFile(product.id, view)), 'utf8');
        expect(checkXml(xml), `product ${product.id} view ${view}`).toEqual([]);
      }
    }
  });

  it('has a valid fallback illustration for each category and a general one', () => {
    for (const slug of FALLBACK_FILES) {
      const xml = fs.readFileSync(path.join(imagesDir, 'categories', `${slug}.svg`), 'utf8');
      expect(checkXml(xml), slug).toEqual([]);
    }
  });

  it('matches what the generator produces now (nothing is stale or hand-edited)', () => {
    for (const art of PRODUCT_ART) {
      for (let view = 1; view <= VIEW_COUNT; view++) {
        const onDisk = fs.readFileSync(path.join(imagesDir, productFile(art.id, view)), 'utf8');
        expect(onDisk === renderView(art, view as 1 | 2 | 3), `product ${art.id} view ${view} differs: run npm run generate:images`).toBe(true);
      }
    }
    for (const slug of FALLBACK_FILES) {
      expect(fs.readFileSync(path.join(imagesDir, 'categories', `${slug}.svg`), 'utf8') === renderFallback(slug), `fallback ${slug}`).toBe(true);
    }
  });

  it('is deterministic: rendering twice gives the same text', () => {
    for (const art of PRODUCT_ART.slice(0, 12)) {
      for (let view = 1; view <= VIEW_COUNT; view++) {
        expect(renderView(art, view as 1 | 2 | 3)).toBe(renderView(art, view as 1 | 2 | 3));
      }
    }
  });

  it('shows three genuinely different pictures for each product', () => {
    for (const art of PRODUCT_ART) {
      const views = [1, 2, 3].map((v) => renderView(art, v as 1 | 2 | 3));
      expect(new Set(views).size, `product ${art.id}`).toBe(3);
    }
  });

  it('keeps every file small and the whole set well under 2 MB', () => {
    let total = 0;
    for (const art of PRODUCT_ART) {
      for (let view = 1; view <= VIEW_COUNT; view++) {
        const size = Buffer.byteLength(renderView(art, view as 1 | 2 | 3));
        expect(size, `product ${art.id} view ${view}`).toBeLessThan(MAX_SVG_BYTES);
        total += size;
      }
    }
    expect(total).toBeLessThan(2 * 1024 * 1024);
  });

  it('contains no text, so long product names cannot break an illustration', () => {
    for (const art of PRODUCT_ART) {
      for (let view = 1; view <= VIEW_COUNT; view++) {
        const xml = renderView(art, view as 1 | 2 | 3);
        expect(xml).not.toMatch(/<text|NaN|undefined/);
      }
    }
  });
});
