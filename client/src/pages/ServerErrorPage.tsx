import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../lib/useDocumentTitle';

/** The 500 page: shown when a page crashes while rendering, and directly at /500. */
export function ServerErrorPage({ onRetry }: { onRetry?: () => void }) {
  useDocumentTitle('Something went wrong');
  return (
    <section aria-labelledby="server-error-heading" data-testid="server-error-page">
      <h1 id="server-error-heading">500: Something went wrong</h1>
      <p>Sorry, this page ran into a problem. Nothing you entered was saved. Please try again.</p>
      <p>
        {onRetry && (
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            Try again
          </button>
        )}{' '}
        <Link to="/">Back to the home page</Link>
      </p>
    </section>
  );
}
