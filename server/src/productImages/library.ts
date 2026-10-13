import type { Motif } from './types';
import { books } from './drawings/books';
import { clothing } from './drawings/clothing';
import { electronics } from './drawings/electronics';
import { home } from './drawings/home';
import { sports } from './drawings/sports';
import { toys } from './drawings/toys';

/** Every drawing in the library, by name. */
export const MOTIFS: Record<string, Motif> = {
  ...electronics,
  ...clothing,
  ...home,
  ...sports,
  ...books,
  ...toys,
};
