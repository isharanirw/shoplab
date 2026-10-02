import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import styles from './TermsPage.module.css';

/** Static page about the project. */
export function AboutPage() {
  useDocumentTitle('About ShopLab');
  return (
    <article className={styles.page} aria-labelledby="about-heading" data-testid="about-page">
      <h1 id="about-heading">About ShopLab</h1>
      <p className={styles.notice}>Demo site. No real payments or personal data.</p>

      <h2>What this is</h2>
      <p>
        ShopLab is a practice online store. It looks and behaves like a small shop (catalogue, cart, checkout, orders, an admin area) so that
        people can practise testing a realistic web application and its API.
      </p>

      <h2>How it was made</h2>
      <p>
        The application was built with AI assistance. All of the testing is done separately, by the project owner, in other repositories, in
        the same way a test team works against a product team.
      </p>

      <h2>Try it</h2>
      <p>
        Browse the <Link to="/products">products</Link>, read the <Link to="/terms">terms</Link> or <Link to="/contact">get in touch</Link>.
        The API is described at <a href="/api/docs">/api/docs</a>.
      </p>
    </article>
  );
}
