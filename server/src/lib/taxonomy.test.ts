import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config';
import { loadSeedData } from '../db/seed';
import { defaultSubcategory, findCategory, findSubcategory, TAXONOMY } from './taxonomy';

describe('taxonomy', () => {
  it('covers every category and subcategory used by the seed products', () => {
    for (const p of loadSeedData(loadConfig().seedDir).products) {
      expect(TAXONOMY[p.category], `category of product ${p.id}`).toBeDefined();
      expect(TAXONOMY[p.category]).toContain(p.subcategory);
    }
  });

  it('matches names ignoring case and spaces and gives back the canonical spelling', () => {
    expect(findCategory(' sPORTS ')).toBe('Sports');
    expect(findCategory('Cars')).toBeNull();
    expect(findSubcategory('Sports', 'racquet sports')).toBe('Racquet Sports');
    expect(findSubcategory('Sports', 'Fiction')).toBeNull();
  });

  it('picks the first subcategory alphabetically as the default', () => {
    expect(defaultSubcategory('Electronics')).toBe('Accessories');
    expect(defaultSubcategory('Toys')).toBe('Building');
  });
});
