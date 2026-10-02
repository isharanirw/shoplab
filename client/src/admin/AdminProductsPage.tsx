import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiRequestError } from '../api/client';
import type { AdminProduct, ListResponse } from '../api/types';
import { ConfirmModal } from '../components/ConfirmModal';
import { ErrorState, Spinner } from '../components/Feedback';
import { Pagination } from '../components/Pagination';
import { ProductImage } from '../components/ProductImage';
import { useFetch } from '../hooks/useFetch';
import { adminListApiPath, adminListSearch, parseAdminListState, PRODUCTS_LIST } from '../lib/adminList';
import type { AdminListState } from '../lib/adminList';
import { formatPrice, pluralise } from '../lib/format';
import { totalPagesOf } from '../lib/pagination';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import styles from './Admin.module.css';
import { useToast } from '../components/Toasts';
import { isTransientError } from '../lib/failure';

/** /admin/products: a searchable, paginated product table with Add, Edit and Delete (with a confirm modal). */
export function AdminProductsPage() {
  useDocumentTitle('Manage products');
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const state = parseAdminListState(params, PRODUCTS_LIST);
  const result = useFetch<ListResponse<AdminProduct>>(adminListApiPath('/api/admin/products', state, PRODUCTS_LIST));
  const [searchText, setSearchText] = useState(state.q);
  const [pendingDelete, setPendingDelete] = useState<AdminProduct | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteRetryable, setDeleteRetryable] = useState(false);
  const toast = useToast();
  const [notice, setNotice] = useState<string | null>((location.state as { notice?: string } | null)?.notice ?? null);
  const deleteTrigger = useRef<HTMLButtonElement | null>(null);

  // A notice handed over by the form page is shown once; clear it from the history entry so a reload does not repeat it.
  useEffect(() => {
    if ((location.state as { notice?: string } | null)?.notice) navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the search box in step with the URL (back and forward, or Clear).
  useEffect(() => {
    setSearchText(state.q);
  }, [state.q]);

  function change(patch: Partial<AdminListState>) {
    setNotice(null);
    setParams(new URLSearchParams(adminListSearch({ ...state, ...patch }, PRODUCTS_LIST)));
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    change({ q: searchText, page: 1 });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    setDeleteRetryable(false);
    try {
      await api<void>(`/api/admin/products/${pendingDelete.id}`, { method: 'DELETE' });
      const removed = pendingDelete;
      setPendingDelete(null);
      setNotice(`Deleted "${removed.name}" (ID ${removed.id}).`);
      toast.success('Product deleted');
      // The last row of a page was deleted: step back one page so the table is not empty.
      if (result.status === 'success' && result.data.data.length === 1 && state.page > 1) {
        setParams(new URLSearchParams(adminListSearch({ ...state, page: state.page - 1 }, PRODUCTS_LIST)));
      } else {
        result.retry();
      }
    } catch (err) {
      setDeleteError(err instanceof ApiRequestError ? err.message : 'Could not delete the product. Please try again.');
      setDeleteRetryable(isTransientError(err));
    } finally {
      setDeleting(false);
    }
  }

  function closeDelete() {
    setPendingDelete(null);
    setDeleteError(null);
    window.setTimeout(() => deleteTrigger.current?.focus(), 0);
  }

  const data = result.status === 'success' ? result.data : null;
  const totalPages = data ? totalPagesOf(data.total, data.pageSize) : 0;
  const filtered = state.q !== '' || state.filter !== '';

  return (
    <section aria-labelledby="admin-products-heading">
      <h1 id="admin-products-heading">Manage products</h1>

      <div className={styles.toolbar}>
        <form role="search" aria-label="Search products" className={styles.searchForm} onSubmit={submitSearch}>
          <div className={styles.toolbarField}>
            <label htmlFor="admin-product-search">Search products</label>
            <input
              id="admin-product-search"
              type="search"
              className="control"
              value={searchText}
              maxLength={100}
              placeholder="Name contains..."
              onChange={(e) => setSearchText(e.target.value)}
              data-testid="admin-product-search"
            />
          </div>
          <button type="submit" className="btn">
            Search
          </button>
        </form>
        <div className={styles.toolbarField}>
          <label htmlFor="admin-product-filter">Status</label>
          <select
            id="admin-product-filter"
            className="control"
            value={state.filter}
            onChange={(e) => change({ filter: e.target.value, page: 1 })}
            data-testid="admin-product-filter"
          >
            <option value="">All products</option>
            <option value="true">Active only</option>
            <option value="false">Inactive only</option>
          </select>
        </div>
        <Link to="/admin/products/new" className={`btn btn-primary ${styles.spacer}`} data-testid="admin-add-product">
          Add product
        </Link>
      </div>

      <div role="status" aria-live="polite">
        {notice && (
          <p className={styles.success} data-testid="admin-notice">
            {notice}
          </p>
        )}
      </div>

      {result.status === 'loading' && <Spinner label="Loading products" />}
      {result.status === 'error' && <ErrorState message={result.error.message} onRetry={result.retry} />}

      {data && (
        <>
          <p className={styles.count} data-testid="admin-product-count">
            {data.total === 0
              ? 'No products found.'
              : `${pluralise(data.total, 'product')}${state.q ? ` matching "${state.q}"` : ''}${
                  state.filter === 'true' ? ' (active)' : state.filter === 'false' ? ' (inactive)' : ''
                }, page ${data.page} of ${Math.max(totalPages, 1)}`}
          </p>
          {data.data.length === 0 ? (
            <div className={styles.empty}>
              {data.total === 0 ? (
                <p>{filtered ? 'No products match your search.' : 'There are no products yet.'}</p>
              ) : (
                <p>There are no products on page {data.page}.</p>
              )}
              {data.total > 0 ? (
                <button type="button" className="btn" onClick={() => change({ page: 1 })}>
                  Go to page 1
                </button>
              ) : (
                filtered && (
                  <button type="button" className="btn" onClick={() => setParams(new URLSearchParams())}>
                    Clear search and filter
                  </button>
                )
              )}
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table} data-testid="admin-products-table">
                <caption className="visually-hidden">Products</caption>
                <thead>
                  <tr>
                    <th scope="col" className={styles.hideNarrow}>
                      ID
                    </th>
                    <th scope="col" className={styles.hideNarrow}>
                      Image
                    </th>
                    <th scope="col">Name</th>
                    <th scope="col" className={styles.hideNarrow}>
                      Category
                    </th>
                    <th scope="col" className={styles.right}>
                      Price
                    </th>
                    <th scope="col" className={`${styles.right} ${styles.hideNarrow}`}>
                      Stock
                    </th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((p) => (
                    <tr key={p.id} data-testid={`admin-product-row-${p.id}`}>
                      <td className={styles.hideNarrow}>{p.id}</td>
                      <td className={styles.hideNarrow}>
                        <div className={styles.thumb}>
                          <ProductImage productId={p.id} name={p.name} imagePath={p.imagePath} decorative />
                        </div>
                      </td>
                      <th scope="row">{p.name}</th>
                      <td className={styles.hideNarrow}>
                        {p.category} / {p.subcategory}
                      </td>
                      <td className={styles.right}>
                        <span className={styles.priceNow}>{formatPrice(p.salePriceCents ?? p.priceCents)}</span>
                        {p.salePriceCents !== null && <span className={styles.priceWas}>{formatPrice(p.priceCents)}</span>}
                      </td>
                      <td className={`${styles.right} ${styles.hideNarrow}`}>{p.stock}</td>
                      <td>
                        <span className={`${styles.badge} ${p.active ? styles.badgeActive : styles.badgeInactive}`}>
                          {p.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <Link to={`/admin/products/${p.id}/edit`} className="btn btn-small" aria-label={`Edit ${p.name}`} data-testid={`admin-edit-${p.id}`}>
                            Edit
                          </Link>
                          <button
                            type="button"
                            className="btn btn-small"
                            aria-label={`Delete ${p.name}`}
                            data-testid={`admin-delete-${p.id}`}
                            onClick={(e) => {
                              deleteTrigger.current = e.currentTarget;
                              setNotice(null);
                              setPendingDelete(p);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={data.page} totalPages={totalPages} onChange={(page) => change({ page })} label="Product pages" />
        </>
      )}

      {pendingDelete && (
        <ConfirmModal
          idPrefix="admin-delete-product"
          title="Delete this product?"
          confirmLabel="Delete product"
          cancelLabel="Keep product"
          busy={deleting}
          error={deleteError}
          errorRetryable={deleteRetryable}
          onConfirm={() => void confirmDelete()}
          onCancel={closeDelete}
        >
          <p>
            <strong>{pendingDelete.name}</strong> (ID {pendingDelete.id}) will be deleted for good. This also removes:
          </p>
          <ul className={styles.modalList}>
            <li>its reviews, and any uploaded pictures,</li>
            <li>it from every cart and wishlist.</li>
          </ul>
          <p>Past orders keep their own copy of the item, so order history still shows it. To hide a product without deleting it, edit it and clear Active.</p>
        </ConfirmModal>
      )}
    </section>
  );
}
