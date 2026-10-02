import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.css';
import { f06 } from '../testability/variants';

interface ModalProps {
  /** ID of the element inside the dialog that names it. */
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
}

/**
 * An accessible modal dialog. It closes on Escape and on a click on the backdrop (the X button is
 * provided by the content through `onClose`), keeps Tab focus inside, makes the rest of the page
 * inert while open, and returns focus to whatever had it before opening.
 */
export function Modal({ labelledBy, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const pressStartedOnBackdrop = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const appRoot = document.getElementById('root');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (appRoot) appRoot.inert = true;

    (focusableIn(dialog)[0] ?? dialog).focus();

    function onKeyDown(event: KeyboardEvent) {
      if (!dialog) return;
      if (event.key === 'Escape' && f06(event.key)) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusableIn(dialog);
      if (items.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (!dialog.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (appRoot) appRoot.inert = false;
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
  }, []);

  return createPortal(
    <div
      className={styles.backdrop}
      data-testid="modal-backdrop"
      onMouseDown={(event) => {
        pressStartedOnBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        // Closing on click (not on mouse down) lets focus return to the trigger after the browser
        // has finished moving it, and a drag that starts inside the dialog does not count.
        if (event.target === event.currentTarget && pressStartedOnBackdrop.current) onCloseRef.current();
        pressStartedOnBackdrop.current = false;
      }}
    >
      <div ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
