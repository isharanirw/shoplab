import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import styles from '../admin/Admin.module.css';

/** Shown to a logged-in customer who opens an admin page. */
export function ForbiddenPage() {
  useDocumentTitle('Access denied');
  return (
    <section aria-labelledby="forbidden-heading" className={styles.forbidden} data-testid="forbidden-page">
      <h1 id="forbidden-heading">403: Access denied</h1>
      <p>You do not have permission to view this page. The admin area is only for administrators.</p>
      <p>
        <Link to="/">Back to the home page</Link> or <Link to="/account">go to your account</Link>.
      </p>
    </section>
  );
}
