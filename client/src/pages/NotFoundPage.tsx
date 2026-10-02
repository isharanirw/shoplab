import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../lib/useDocumentTitle';

export function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <section aria-labelledby="notfound-heading">
      <h1 id="notfound-heading">Page not found</h1>
      <p>We could not find the page you were looking for.</p>
      <p>
        <Link to="/">Back to the home page</Link>
      </p>
    </section>
  );
}
