import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api, ApiRequestError } from '../api/client';
import type { Cart, MergeReportItem } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { addGuestLine, describeMerge, guestItemCount, loadGuestCart, saveGuestCart } from '../lib/cart';
import type { CartLine } from '../lib/cart';

interface CartState {
  /** Total units in the cart (the header badge): the server cart when logged in, the guest cart otherwise. */
  count: number;
  /** The guest cart (empty when logged in, because it is merged into the server cart at login). */
  guestLines: CartLine[];
  /** True while a guest cart is being merged into the server cart right after login. */
  syncing: boolean;
  /** Changes whenever the server cart was changed behind the page's back (merge, order placed). */
  version: number;
  /** Lines the merge had to change, for a notice on the cart page. */
  mergeNotice: string[] | null;
  dismissMergeNotice: () => void;
  /** Adds a line. `stock` is the stock of the chosen product or variant (used for the guest cart). Throws Error with a readable message. */
  addItem: (line: CartLine, stock: number) => Promise<void>;
  /** Tells the context what the server cart looks like now, so the badge follows. */
  setServerCart: (cart: Cart) => void;
  /** Replaces the guest cart (and stores it). */
  setGuestLines: (lines: CartLine[]) => void;
  /** Forget the server cart count (after an order). */
  resetServerCount: () => void;
}

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [guestLines, setGuestLinesState] = useState<CartLine[]>(() => loadGuestCart());
  const [serverCount, setServerCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [version, setVersion] = useState(0);
  const [mergeNotice, setMergeNotice] = useState<string[] | null>(null);
  const syncedFor = useRef<number | null>(null);
  const guestRef = useRef(guestLines);
  guestRef.current = guestLines;

  const setGuestLines = useCallback((lines: CartLine[]) => {
    saveGuestCart(lines);
    setGuestLinesState(lines);
  }, []);

  // When someone logs in, merge the guest cart into their server cart (or just read the server cart).
  const userId = user?.id ?? null;
  useEffect(() => {
    if (loading) return;
    if (userId === null) {
      syncedFor.current = null;
      setServerCount(0);
      return;
    }
    if (syncedFor.current === userId) return;
    syncedFor.current = userId;
    const lines = guestRef.current;

    async function sync() {
      setSyncing(true);
      try {
        if (lines.length > 0) {
          const result = await api<{ cart: Cart; adjustments: MergeReportItem[] }>('/api/cart/merge', {
            method: 'POST',
            body: { items: lines },
          });
          setServerCount(result.cart.itemCount);
          setGuestLines([]);
          setMergeNotice(result.adjustments.length > 0 ? describeMerge(result.adjustments) : null);
        } else {
          const cart = await api<Cart>('/api/cart');
          setServerCount(cart.itemCount);
        }
      } catch {
        // The cart page shows its own error with Retry; the badge stays at the last known value.
      } finally {
        setSyncing(false);
        setVersion((v) => v + 1);
      }
    }
    void sync();
  }, [userId, loading, setGuestLines]);

  const addItem = useCallback(
    async (line: CartLine, stock: number) => {
      if (userId !== null) {
        try {
          const cart = await api<Cart>('/api/cart/items', { method: 'POST', body: line });
          setServerCount(cart.itemCount);
        } catch (err) {
          if (err instanceof ApiRequestError) throw err;
          throw new Error('Could not add that to your cart. Please try again.');
        }
        return;
      }
      const change = addGuestLine(guestRef.current, line, stock);
      if (change.error) throw new Error(change.error);
      setGuestLines(change.lines);
    },
    [userId, setGuestLines],
  );

  const setServerCart = useCallback((cart: Cart) => setServerCount(cart.itemCount), []);
  const resetServerCount = useCallback(() => {
    setServerCount(0);
    setVersion((v) => v + 1);
  }, []);
  const dismissMergeNotice = useCallback(() => setMergeNotice(null), []);

  const count = userId !== null ? serverCount : guestItemCount(guestLines);
  const value = useMemo<CartState>(
    () => ({ count, guestLines, syncing, version, mergeNotice, dismissMergeNotice, addItem, setServerCart, setGuestLines, resetServerCount }),
    [count, guestLines, syncing, version, mergeNotice, dismissMergeNotice, addItem, setServerCart, setGuestLines, resetServerCount],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
