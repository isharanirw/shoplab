import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { CategoryNode } from '../api/types';
import { useFetch } from '../hooks/useFetch';
import type { FetchResult } from '../hooks/useFetch';

const CategoriesContext = createContext<FetchResult<{ data: CategoryNode[] }> | null>(null);

/** Loads /api/categories once and shares it with the header, the home page and the listing filters. */
export function CategoriesProvider({ children }: { children: ReactNode }) {
  const result = useFetch<{ data: CategoryNode[] }>('/api/categories');
  return <CategoriesContext.Provider value={result}>{children}</CategoriesContext.Provider>;
}

export function useCategories(): FetchResult<{ data: CategoryNode[] }> {
  const ctx = useContext(CategoriesContext);
  if (!ctx) throw new Error('useCategories must be used inside CategoriesProvider');
  return ctx;
}
