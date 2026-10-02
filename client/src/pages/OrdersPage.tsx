import { Link, useSearchParams } from 'react-router-dom';
import type { ListResponse, OrderSummary } from '../api/types';
import { ErrorState, Spinner } from '../components/Feedback';
import { OrderStatusBadge } from '../components/OrderStatusBadge';
import { Pagination } from '../components/Pagination';
import { useFetch } from '../hooks/useFetch';
import { formatDate, formatPrice, pluralise } from '../lib/format';
import {
  ariaSortFor,
  nextSort,
  orderListApiPath,
  orderListSearch,
  ORDER_STATUSES,
  parseOrderListState,
} from '../lib/orders';
import type { OrderListState, SortColumn } from '../lib/orders';
import { totalPagesOf } from '../lib/pagination';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import styles from './Orders.module.css';

/** /account/orders: the user's orders, sortable by date and total, filterable by status, 5 per page. All of it lives in the URL query string. */
export function OrdersPage() {
  useDocumentTitle('Order history');
  const [params, setParams] = useSearchParams();
  const state = parseOrderListState(params);
  const result = useFetch<ListResponse<OrderSummary>>(orderListApiPath(state));

  function change(patch: Partial<OrderListState>) {
    const next = { ...state, ...patch };
    setParams(new URLSearchParams(orderListSearch(next)));
  }

  function sortButton(column: SortColumn, label: string) {
    const sort = ariaSortFor(state.sort, column);
    const arrow = sort === 'ascending' ? '▲' : sort === 'descending' ? '▼' : '';
    return (
      <button
        type="button"
        className={styles.sortButton}
        onClick={() => change({ sort: nextSort(state.sort, column), page: 1 })}
        data-testid={`sort-${column}`}
      >
        {label}
        <span aria-hidden="true" className={styles.arrow}>
          {arrow}
        </span>
      </button>
    );
  }

  const data = result.status === 'success' ? result.data : null;
  const totalPages = data ? totalPagesOf(data.total, data.pageSize) : 0;

  return (
    <section aria-labelledby="orders-heading">
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link to="/account">My account</Link> / Order history
      </nav>
      <h1 id="orders-heading">Order history</h1>

      <div className={styles.toolbar}>
        <label htmlFor="order-status-filter">Status</label>
        <select
          id="order-status-filter"
          className="control"
          value={state.status ?? ''}
          onChange={(e) => change({ status: e.target.value === '' ? null : (e.target.value as OrderListState['status']), page: 1 })}
          data-testid="order-status-filter"
        >
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {data && (
          <p className={styles.count} role="status" data-testid="order-count">
            {pluralise(data.total, 'order')}
            {state.status ? ` with status ${state.status}` : ''}
          </p>
        )}
      </div>

      {result.status === 'loading' && <Spinner label="Loading your orders" />}
      {result.status === 'error' && <ErrorState message={result.error.message} onRetry={result.retry} />}

      {data && data.total === 0 && (
        <div className={styles.empty} data-testid="orders-empty">
          {state.status ? (
            <>
              <h2>No {state.status} orders</h2>
              <p>You have no orders with this status.</p>
              <button type="button" className="btn" onClick={() => change({ status: null, page: 1 })}>
                Show all orders
              </button>
            </>
          ) : (
            <>
              <h2>You have not placed any orders yet</h2>
              <p>When you do, they will be listed here.</p>
              <Link to="/products" className="btn btn-primary">
                Browse products
              </Link>
            </>
          )}
        </div>
      )}

      {data && data.total > 0 && data.data.length === 0 && (
        <div className={styles.empty} data-testid="orders-page-empty">
          <p>There are no orders on page {data.page}.</p>
          <button type="button" className="btn" onClick={() => change({ page: 1 })}>
            Go to the first page
          </button>
        </div>
      )}

      {data && data.data.length > 0 && (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table} data-testid="orders-table">
              <caption className="visually-hidden">Your orders. Use the Date and Total column buttons to sort.</caption>
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col" aria-sort={ariaSortFor(state.sort, 'date')}>
                    {sortButton('date', 'Date')}
                  </th>
                  <th scope="col" className={styles.hideNarrow}>
                    Items
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col" aria-sort={ariaSortFor(state.sort, 'total')} className={styles.right}>
                    {sortButton('total', 'Total')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((o) => (
                  <tr key={o.id} data-testid={`order-row-${o.id}`}>
                    <th scope="row">
                      <Link to={`/account/orders/${o.id}`} data-testid={`order-link-${o.id}`}>
                        {o.number}
                      </Link>
                    </th>
                    <td>{formatDate(o.createdAt)}</td>
                    <td className={styles.hideNarrow}>{o.itemCount}</td>
                    <td>
                      <OrderStatusBadge status={o.status} />
                    </td>
                    <td className={styles.right}>{formatPrice(o.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination label="Orders pagination" page={data.page} totalPages={totalPages} onChange={(page) => change({ page })} />
        </>
      )}
    </section>
  );
}
