import type { ShippingMethod } from '../api/types';
import { formatPrice } from '../lib/format';
import { longDate } from '../lib/delivery';
import type { DeliveryWindow } from '../lib/delivery';
import { DeliveryCalendar } from './DeliveryCalendar';
import styles from './Checkout.module.css';

interface DeliveryStepProps {
  method: ShippingMethod;
  onMethod: (method: ShippingMethod) => void;
  date: string | null;
  onDate: (isoDate: string) => void;
  window: DeliveryWindow;
  /** Explains why the date was cleared after the method changed. */
  note: string | null;
  error: string | null;
}

/** Step 2: Standard or Express, then a preferred delivery date from the calendar. */
export function DeliveryStep({ method, onMethod, date, onDate, window: range, note, error }: DeliveryStepProps) {
  return (
    <div>
      <fieldset className={styles.choiceSet}>
        <legend className={styles.legend}>Shipping method</legend>
        <div className={styles.choice}>
          <input
            type="radio"
            id="shipping-standard"
            name="shipping-method"
            checked={method === 'standard'}
            onChange={() => onMethod('standard')}
            data-testid="shipping-standard"
          />
          <label htmlFor="shipping-standard">
            <strong>Standard</strong> {formatPrice(500)}
            <span className={styles.choiceDetail}>Free when your subtotal after discount is {formatPrice(10000)} or more. Not delivered at weekends.</span>
          </label>
        </div>
        <div className={styles.choice}>
          <input
            type="radio"
            id="shipping-express"
            name="shipping-method"
            checked={method === 'express'}
            onChange={() => onMethod('express')}
            data-testid="shipping-express"
          />
          <label htmlFor="shipping-express">
            <strong>Express</strong> {formatPrice(1500)}
            <span className={styles.choiceDetail}>Never free. Delivered any day, including weekends.</span>
          </label>
        </div>
      </fieldset>

      <div className={styles.dateBlock}>
        <h3 className={styles.subheading}>Preferred delivery date</h3>
        <p className={styles.help}>Choose a day from tomorrow up to 14 days ahead.</p>
        <DeliveryCalendar key={method} value={date} method={method} window={range} onSelect={onDate} />
        <div role="status" aria-live="polite" className={styles.dateStatus} data-testid="selected-date">
          {date ? `Selected delivery date: ${longDate(date)}` : note}
        </div>
        {date && note && (
          <p className={styles.help} role="status">
            {note}
          </p>
        )}
        {error && (
          <p role="alert" className={styles.stepError} data-testid="delivery-error">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
