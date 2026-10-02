import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api/client';
import type { ListResponse, ProductSummary } from '../api/types';
import { useAuth } from '../auth/AuthContext';

interface WishlistState {
  /** IDs of the products on the signed-in user's wishlist (empty when logged out). */
  ids: ReadonlySet<number>;
  has: (productId: number) => boolean;
  add: (productId: number) => Promise<void>;
  remove: (productId: number) => Promise<void>;
}

const WishlistContext = createContext<WishlistState | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [ids, setIds] = useState<ReadonlySet<number>>(new Set());

  useEffect(() => {
    if (userId === null) {
      setIds(new Set());
      return;
    }
    const controller = new AbortController();
    api<ListResponse<ProductSummary>>('/api/wishlist', { signal: controller.signal })
      .then((res) => {
        if (!controller.signal.aborted) setIds(new Set(res.data.map((p) => p.id)));
      })
      .catch(() => {
        // The hearts simply start empty if this fails; toggling still talks to the server.
      });
    return () => controller.abort();
  }, [userId]);

  const add = useCallback(async (productId: number) => {
    await api<{ productId: number }>('/api/wishlist', { method: 'POST', body: { productId } });
    setIds((prev) => new Set(prev).add(productId));
  }, []);

  const remove = useCallback(async (productId: number) => {
    await api<void>(`/api/wishlist/${productId}`, { method: 'DELETE' });
    setIds((prev) => {
      const next = new Set(prev);
      next.delete(productId);
      return next;
    });
  }, []);

  const value = useMemo<WishlistState>(() => ({ ids, has: (id) => ids.has(id), add, remove }), [ids, add, remove]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistState {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used inside WishlistProvider');
  return ctx;
}
