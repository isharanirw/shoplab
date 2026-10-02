import { useDocumentTitle } from '../lib/useDocumentTitle';
import styles from './TermsPage.module.css';

/** Static terms and conditions. The checkout review step opens this page in a new tab. */
export function TermsPage() {
  useDocumentTitle('Terms and conditions');
  return (
    <article className={styles.page} aria-labelledby="terms-heading" data-testid="terms-page">
      <h1 id="terms-heading">Terms and conditions</h1>
      <p className={styles.notice}>
        ShopLab is a demo shop used to practise software testing. Nothing here is a real offer, and no real goods, payments or personal data
        are involved.
      </p>

      <h2>1. About this site</h2>
      <p>
        ShopLab is a practice application. Orders are not fulfilled, nothing is shipped, and no money changes hands. The products,
        prices, coupons and reviews are made up.
      </p>

      <h2>2. Orders</h2>
      <p>
        When you place an order the site records it so you can see it in your account. Stock levels change as demo orders are placed, and
        the whole shop can be reset to its starting data at any time without notice.
      </p>

      <h2>3. Payment</h2>
      <p>
        No real payment is taken. The payment form accepts only the published test card numbers. Please never enter a real card number,
        security code or any other real payment detail.
      </p>

      <h2>4. Delivery</h2>
      <p>
        Delivery dates are preferences shown for practice. Standard delivery is not offered on weekends; Express delivery can be chosen
        for any day from tomorrow up to 14 days ahead.
      </p>

      <h2>5. Coupons</h2>
      <p>One coupon can be used per order. A coupon marked once per account can be used on one order only, and expired coupons are refused.</p>

      <h2>6. Your data</h2>
      <p>Use made-up details. Anything you enter may be deleted when the demo data is reset.</p>
    </article>
  );
}
