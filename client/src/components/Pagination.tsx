import { pageWindow } from '../lib/pagination';
import styles from './Pagination.module.css';

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  label?: string;
}

/** Previous and Next buttons around numbered page buttons. Renders nothing for a single page. */
export function Pagination({ page, totalPages, onChange, label = 'Pagination' }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label={label} className={styles.nav} data-testid="pagination">
      <ul className={styles.list}>
        <li>
          <button type="button" className="btn btn-small" disabled={page <= 1} onClick={() => onChange(page - 1)}>
            Previous
          </button>
        </li>
        {pageWindow(page, totalPages).map((item) =>
          typeof item === 'number' ? (
            <li key={item}>
              <button
                type="button"
                className={item === page ? `btn btn-small btn-primary ${styles.current}` : 'btn btn-small'}
                aria-current={item === page ? 'page' : undefined}
                onClick={() => onChange(item)}
              >
                <span className="visually-hidden">Page </span>
                {item}
              </button>
            </li>
          ) : (
            <li key={item} aria-hidden="true" className={styles.ellipsis}>
              …
            </li>
          ),
        )}
        <li>
          <button type="button" className="btn btn-small" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
            Next
          </button>
        </li>
      </ul>
    </nav>
  );
}
