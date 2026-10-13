import fs from 'node:fs';
import path from 'node:path';
import type { ProductArt } from './compose';
import { VIEW_COUNT, renderView } from './compose';
import { FALLBACK_FILES, renderFallback } from './fallback';

/** Where a generated picture lives, relative to the images folder. */
export function productFile(id: number, view: number): string {
  return path.join('products', String(id), `${view}.svg`);
}

/** Writes every picture for the given products (3 each) under `outDir`. Returns the number of files written. */
export function writeProducts(outDir: string, art: ProductArt[]): number {
  let count = 0;
  for (const product of art) {
    for (let view = 1; view <= VIEW_COUNT; view++) {
      const file = path.join(outDir, productFile(product.id, view));
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, renderView(product, view as 1 | 2 | 3), 'utf8');
      count++;
    }
  }
  return count;
}

/** Writes the category fallback illustrations (one per category plus a general one). */
export function writeFallbacks(outDir: string): number {
  const dir = path.join(outDir, 'categories');
  fs.mkdirSync(dir, { recursive: true });
  for (const slug of FALLBACK_FILES) fs.writeFileSync(path.join(dir, `${slug}.svg`),renderFallback(slug), 'utf8');
  return FALLBACK_FILES.length;
}
