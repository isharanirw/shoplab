import { useEffect, useRef } from 'react';
import type { DependencyList, EffectCallback } from 'react';

/**
 * Like useEffect, but skips the first run (the mount). Use it to keep local state in step with a value
 * that changes later (the URL, a saved quantity) when the state already started from that value. Running
 * such an effect at mount can overwrite something typed in the first moments after the page appears.
 */
export function useUpdateEffect(effect: EffectCallback, deps: DependencyList): void {
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return undefined;
    }
    return effect();
    // The caller owns the dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
