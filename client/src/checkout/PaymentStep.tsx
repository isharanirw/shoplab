import { useEffect, useRef } from 'react';
import type { CardToken } from '../lib/card';
import { isPaymentFrameMessage } from '../lib/paymentFrame';
import styles from './Checkout.module.css';

interface PaymentStepProps {
  payment: CardToken | null;
  onPayment: (payment: CardToken | null) => void;
  /** Changing this remounts the frame, which empties the card form. */
  frameKey: number;
  error: string | null;
}

/**
 * Step 3: the card form lives in an iframe served from /payment-frame (same origin). The frame posts
 * a payment token and the last four digits; this page checks the message came from that frame and
 * origin. The card number and CVC are never available here and never sent to the server.
 */
export function PaymentStep({ payment, onPayment, frameKey, error }: PaymentStepProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.source !== frameRef.current?.contentWindow) return;
      if (!isPaymentFrameMessage(event.data)) return;
      if (event.data.type === 'card-accepted') onPayment({ token: event.data.token, last4: event.data.last4 });
      else onPayment(null);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onPayment]);

  return (
    <div>
      <p className={styles.help}>Enter your card details in the form below, then choose "Use this card". Use a test card only; no real payment is taken.</p>
      <iframe
        key={frameKey}
        ref={frameRef}
        src="/payment-frame"
        title="Card payment details"
        className={styles.paymentFrame}
        data-testid="payment-frame"
      />
      <div role="status" aria-live="polite" className={styles.dateStatus} data-testid="payment-status">
        {payment ? `Card ending ${payment.last4} is ready to use.` : null}
      </div>
      {error && (
        <p role="alert" className={styles.stepError} data-testid="payment-error">
          {error}
        </p>
      )}
    </div>
  );
}
