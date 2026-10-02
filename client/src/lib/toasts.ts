export const TOAST_DURATION_MS = 4000;
export const MAX_VISIBLE_TOASTS = 4;

export type ToastKind = 'success' | 'error';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

/** Adds a toast at the end. When more than the limit are showing, the oldest are dropped. */
export function addToast(list: readonly Toast[], toast: Toast): Toast[] {
  return [...list, toast].slice(-MAX_VISIBLE_TOASTS);
}

export function removeToast(list: readonly Toast[], id: number): Toast[] {
  return list.filter((t) => t.id !== id);
}

/** The ID for the next toast: one more than the highest used so far. */
export function nextToastId(list: readonly Toast[], lastId: number): number {
  return Math.max(lastId, ...list.map((t) => t.id)) + 1;
}
