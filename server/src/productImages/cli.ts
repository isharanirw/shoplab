import path from 'node:path';
import { PRODUCT_ART } from './catalogue';
import { writeFallbacks, writeProducts } from './generate';

// Usage: npm run generate:images   (writes client/public/images). An optional first argument overrides the folder.
const outDir = process.argv[2] ?? path.resolve(__dirname, '..', '..', '..', 'client', 'public', 'images');
const only = process.env.ONLY ? new Set(process.env.ONLY.split(',').map(Number)) : null;
const count = writeProducts(
  outDir,
  PRODUCT_ART.filter((p) => !only || only.has(p.id)),
);
const fallbacks = only ? 0 : writeFallbacks(outDir);
console.log(`Wrote ${count + fallbacks} files under ${outDir}`);
