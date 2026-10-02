import { useFetch } from '../hooks/useFetch';
import styles from './Layout.module.css';

interface Geo {
  countryCode: string;
  countryName: string;
}

const SHIPPING_ID = `shipping-to-${Math.random().toString(36).slice(2, 8)}`;

/** The "Shipping to <country>" note in the header, loaded from /api/geo. A failure only affects this note. */
export function ShippingTo() {
  const geo = useFetch<Geo>('/api/geo');
  return (
    <p className={styles.shippingTo} id={SHIPPING_ID}>
      {geo.status === 'loading' && <span aria-busy="true">Shipping to ...</span>}
      {geo.status === 'success' && <span>Shipping to {geo.data.countryName}</span>}
      {geo.status === 'error' && (
        <>
          <span>Shipping destination unavailable</span>{' '}
          <button type="button" className={styles.linkButton} onClick={geo.retry}>
            Retry
          </button>
        </>
      )}
    </p>
  );
}
