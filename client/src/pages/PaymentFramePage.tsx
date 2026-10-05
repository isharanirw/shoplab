import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { FormField } from '../components/FormField';
import { formatCardNumber, formatExpiry, tokenFor, validateCard, validateCardName, validateCardNumber, validateCvc, validateExpiry } from '../lib/card';
import type { CardErrors, CardInput, CardToken } from '../lib/card';
import { acceptedMessage, clearedMessage } from '../lib/paymentFrame';
import type { PaymentFrameMessage } from '../lib/paymentFrame';
import styles from './PaymentFramePage.module.css';

const EMPTY: CardInput = { name: '', number: '', expiry: '', cvc: '' };

function post(message: PaymentFrameMessage): void {
  // Only the embedding page of the same origin may receive it. The card number and CVC are never posted.
  if (window.parent !== window) window.parent.postMessage(message, window.location.origin);
}

/**
 * The card form served at /payment-frame and embedded in an iframe on the checkout page. It checks
 * the details locally (no real processing) and posts only a payment token and the last four digits
 * to the parent window. The full card number and CVC never leave this document.
 */
export function PaymentFramePage() {
  const [values, setValues] = useState<CardInput>(EMPTY);
  const [errors, setErrors] = useState<CardErrors>({});
  const [accepted, setAccepted] = useState<CardToken | null>(null);

  useEffect(() => {
    document.title = 'Card payment details | ShopLab';
  }, []);

  function update(field: keyof CardInput, raw: string) {
    const value = field === 'number' ? formatCardNumber(raw) : field === 'expiry' ? formatExpiry(raw) : field === 'cvc' ? raw.replace(/\D/g, '').slice(0, 3) : raw;
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
    if (accepted) {
      setAccepted(null);
      post(clearedMessage());
    }
  }

  function validateField(field: keyof CardInput) {
    const message =
      field === 'name'
        ? validateCardName(values.name)
        : field === 'number'
          ? validateCardNumber(values.number)
          : field === 'expiry'
            ? validateExpiry(values.expiry, new Date())
            : validateCvc(values.cvc);
    setErrors((e) => ({ ...e, [field]: message ?? undefined }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateCard(values, new Date());
    setErrors(found);
    const token = Object.keys(found).length === 0 ? tokenFor(values.number) : null;
    if (!token) {
      setAccepted(null);
      post(clearedMessage());
      return;
    }
    setAccepted(token);
    post(acceptedMessage(token.token, token.last4));
  }

  return (
    <main className={styles.frame} aria-label="Card payment">
      <h1 className="visually-hidden">Card payment details</h1>
      <form onSubmit={handleSubmit} noValidate aria-label="Card details" data-testid="payment-form">
        <FormField
          id="card-name"
          label="Name on card"
          autoComplete="cc-name"
          value={values.name}
          error={errors.name}
          onChange={(e) => update('name', e.target.value)}
          onBlur={() => validateField('name')}
        />
        <FormField
          id="card-number"
          label="Card number"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="1234 1234 1234 1234"
          value={values.number}
          error={errors.number}
          onChange={(e) => update('number', e.target.value)}
          onBlur={() => validateField('number')}
        />
        <div className={styles.row}>
          <FormField
            id="card-expiry"
            label="Expiry (MM/YY)"
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder="MM/YY"
            value={values.expiry}
            error={errors.expiry}
            onChange={(e) => update('expiry', e.target.value)}
            onBlur={() => validateField('expiry')}
          />
          <FormField
            id="card-cvc"
            label="Security code (CVC)"
            inputMode="numeric"
            autoComplete="cc-csc"
            placeholder="123"
            value={values.cvc}
            error={errors.cvc}
            onChange={(e) => update('cvc', e.target.value)}
            onBlur={() => validateField('cvc')}
          />
        </div>
        <button type="submit" className={`btn btn-primary ${styles.submit}`} data-testid="use-card">
          Use this card
        </button>
        <div role="status" aria-live="polite" className={styles.status} data-testid="card-status">
          {accepted && <p className={styles.ok}>Card ending {accepted.last4} saved. Continue to the next step.</p>}
        </div>
        <p className={styles.hint}>Demo only. Test cards: 4242 4242 4242 4242 (approved) and 4000 0000 0000 0002 (declined). Any future expiry and a 3 digit code.</p>
      </form>
    </main>
  );
}
