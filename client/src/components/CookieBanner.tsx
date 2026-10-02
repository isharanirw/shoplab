import { useState } from 'react';
import { ACCEPT_ALL, REJECT_ALL, browserStorage, readConsent, saveConsent } from '../lib/cookieConsent';
import type { ConsentChoice } from '../lib/cookieConsent';
import styles from './CookieBanner.module.css';

/** First-visit cookie notice: Accept all, Reject all, or Manage with a toggle per category. The choice is kept in localStorage. */
export function CookieBanner() {
  const [decided, setDecided] = useState(() => readConsent(browserStorage()) !== null);
  const [managing, setManaging] = useState(false);
  const [custom, setCustom] = useState<ConsentChoice>({ analytics: false, marketing: false });

  if (decided) return null;

  function choose(choice: ConsentChoice) {
    saveConsent(browserStorage(), choice);
    setDecided(true);
  }

  return (
    <section className={styles.banner} aria-label="Cookie consent" data-testid="cookie-banner">
      <p className={styles.text}>
        We use cookies to keep the demo working and, if you agree, to count visits. No real personal data is collected.
      </p>
      {managing && (
        <fieldset className={styles.toggles}>
          <legend>Choose which cookies to allow</legend>
          <label className={styles.toggle}>
            <input type="checkbox" checked disabled /> Strictly necessary (always on)
          </label>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={custom.analytics}
              onChange={(e) => setCustom((c) => ({ ...c, analytics: e.target.checked }))}
              data-testid="consent-analytics"
            />{' '}
            Analytics
          </label>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={custom.marketing}
              onChange={(e) => setCustom((c) => ({ ...c, marketing: e.target.checked }))}
              data-testid="consent-marketing"
            />{' '}
            Marketing
          </label>
        </fieldset>
      )}
      <div className={styles.actions}>
        <button type="button" className="btn btn-small btn-primary" onClick={() => choose(ACCEPT_ALL)}>
          Accept all
        </button>
        <button type="button" className="btn btn-small" onClick={() => choose(REJECT_ALL)}>
          Reject all
        </button>
        {managing ? (
          <button type="button" className="btn btn-small" onClick={() => choose(custom)}>
            Save choices
          </button>
        ) : (
          <button type="button" className="btn btn-small" onClick={() => setManaging(true)}>
            Manage
          </button>
        )}
      </div>
    </section>
  );
}
