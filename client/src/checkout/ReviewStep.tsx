import { Link } from 'react-router-dom';
import type { Country, SavedAddress, ShippingMethod } from '../api/types';
import { CheckboxField } from '../components/FormField';
import type { AddressForm } from '../lib/address';
import { longDate } from '../lib/delivery';
import type { CardToken } from '../lib/card';
import styles from './Checkout.module.css';

interface ReviewStepProps {
  addressLabel: string;
  addressLines: string[];
  method: ShippingMethod;
  date: string | null;
  payment: CardToken | null;
  terms: boolean;
  onTerms: (accepted: boolean) => void;
  termsError: string | null;
  onEdit: (step: 1 | 2 | 3) => void;
}

/** Builds the lines shown for the chosen address on the review step. */
export function describeAddress(saved: SavedAddress | undefined, form: AddressForm, countries: Country[]): { label: string; lines: string[] } {
  if (saved) {
    return {
      label: saved.label,
      lines: [`${saved.firstName} ${saved.lastName}`, saved.street, [saved.city, `${saved.regionName} ${saved.postalCode}`].filter(Boolean).join(', '), saved.countryName, saved.phone],
    };
  }
  const country = countries.find((c) => c.code === form.countryCode);
  const region = country?.regions.find((r) => r.code === form.regionCode);
  return {
    label: 'New address',
    lines: [`${form.firstName.trim()} ${form.lastName.trim()}`, form.street.trim(), `${region?.name ?? ''} ${form.postalCode.trim()}`.trim(), country?.name ?? '', form.phone.trim()],
  };
}

/** Step 4: a read-only recap, the terms checkbox with the link to /terms (new tab), then Place order. */
export function ReviewStep(props: ReviewStepProps) {
  const { addressLabel, addressLines, method, date, payment, terms, onTerms, termsError, onEdit } = props;
  return (
    <div>
      <dl className={styles.review}>
        <div className={styles.reviewRow}>
          <dt>Ship to</dt>
          <dd data-testid="review-address">
            <strong>{addressLabel}</strong>
            {addressLines.map((line) => (
              <span key={line} className={styles.choiceDetail}>
                {line}
              </span>
            ))}
            <button type="button" className={styles.linkButton} onClick={() => onEdit(1)}>
              Change address
            </button>
          </dd>
        </div>
        <div className={styles.reviewRow}>
          <dt>Delivery</dt>
          <dd data-testid="review-delivery">
            {method === 'express' ? 'Express' : 'Standard'}, preferred date {date ? longDate(date) : 'not chosen'}
            <button type="button" className={styles.linkButton} onClick={() => onEdit(2)}>
              Change delivery
            </button>
          </dd>
        </div>
        <div className={styles.reviewRow}>
          <dt>Payment</dt>
          <dd data-testid="review-payment">
            {payment ? `Card ending ${payment.last4}` : 'No card entered'}
            <button type="button" className={styles.linkButton} onClick={() => onEdit(3)}>
              Change payment
            </button>
          </dd>
        </div>
      </dl>

      <div className={styles.terms}>
        <CheckboxField
          id="accept-terms"
          label="I agree to the terms and conditions of this order"
          checked={terms}
          error={termsError}
          onChange={(e) => onTerms(e.target.checked)}
          data-testid="accept-terms"
        />
        <p className={styles.termsLink}>
          <Link to="/terms" target="_blank" rel="noopener noreferrer" data-testid="terms-link">
            Terms and conditions<span className="visually-hidden"> (opens in a new tab)</span>
          </Link>
        </p>
      </div>
    </div>
  );
}
