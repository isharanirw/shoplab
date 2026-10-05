import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { TOAST_DURATION_MS, addToast, nextToastId, removeToast } from '../lib/toasts';
import type { Toast, ToastKind } from '../lib/toasts';
import styles from './Toasts.module.css';

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Shows short success and error messages in the corner; each one goes away by itself after 4 seconds. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastId = useRef(0);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((list) => removeToast(list, id));
  }, []);

  const show = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextToastId([], lastId.current);
      lastId.current = id;
      setToasts((list) => addToast(list, { id, kind, message }));
      timers.current.set(id, window.setTimeout(() => dismiss(id), TOAST_DURATION_MS));
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const api = useMemo<ToastApi>(() => ({ success: (m) => show('success', m), error: (m) => show('error', m) }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.region} data-testid="toast-region" aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${styles.toast} ${t.kind === 'error' ? styles.error : styles.success}`}
            role={t.kind === 'error' ? 'alert' : 'status'}
            data-testid={`toast-${t.kind}`}
          >
            <span>{t.message}</span>
            <button type="button" className={styles.dismiss} aria-label="Dismiss notification" onClick={() => dismiss(t.id)}>
              <span aria-hidden="true">×</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
