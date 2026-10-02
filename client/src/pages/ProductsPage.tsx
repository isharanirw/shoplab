import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ListResponse, ProductSummary } from '../api/types';
import { useCategories } from '../components/CategoriesContext';
import { ErrorState, Spinner } from '../components/Feedback';
import { Pagination } from '../components/Pagination';
import { ProductGrid, ProductGridSkeleton } from '../components/ProductGrid';
import { useFetch } from '../hooks/useFetch';
import { pluralise } from '../lib/format';
import { totalPagesOf } from '../lib/pagination';
import {
  EMPTY_FILTERS,
  RATING_OPTIONS,
  SORT_OPTIONS,
  hasActiveFilters,
  hasCategory,
  parseFilters,
  priceRangeError,
  toApiQuery,
  toSearchParams,
  toggleCategory,
} from '../lib/productQuery';
import type { ListFilters, SortValue } from '../lib/productQuery';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { ApiRequestError } from '../api/client';
import styles from './ProductsPage.module.css';

const PAGE_SIZE = 12;

function describeFilterError(err: ApiRequestError): string {
  const details = Object.values(err.fieldErrors);
  return details.length > 0 ? `${err.message} ${details.join(' ')}` : err.message;
}

export function ProductsPage() {
  useDocumentTitle('Products');
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(params), [params]);
  const categories = useCategories();

  const [minPrice, setMinPrice] = useState(filters.minPrice);
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Keep the price boxes in step with the URL (back/forward, clear all, direct load).
  useEffect(() => {
    setMinPrice(filters.minPrice);
    setMaxPrice(filters.maxPrice);
    setPriceError(null);
  }, [filters.minPrice, filters.maxPrice]);

  const result = useFetch<ListResponse<ProductSummary>>(`/api/products?${toApiQuery(filters, PAGE_SIZE)}`);

  /** Writes new filters to the URL. Any change other than the page itself goes back to page 1. */
  function update(patch: Partial<ListFilters>) {
    const next: ListFilters = { ...filters, page: 1, ...patch };
    setParams(toSearchParams(next));
  }

  function changePage(page: number) {
    update({ page });
    window.scrollTo({ top: 0 });
  }

  function clearAll() {
    setParams(toSearchParams({ ...EMPTY_FILTERS, sort: filters.sort }));
  }

  function applyPrice(event: FormEvent) {
    event.preventDefault();
    const error = priceRangeError(minPrice, maxPrice);
    setPriceError(error);
    if (error) return;
    update({ minPrice: minPrice.trim(), maxPrice: maxPrice.trim() });
  }

  const categoryNames = categories.status === 'success' ? categories.data.data.map((c) => c.name) : [];

  return (
    <div>
      <h1>{filters.q ? `Search results` : 'Products'}</h1>
      {filters.q && (
        <p className={styles.chips}>
          Showing results for <strong>“{filters.q}”</strong>{' '}
          <button type="button" className="btn btn-small" onClick={() => update({ q: '' })}>
            Clear search
          </button>
        </p>
      )}

      <div className={styles.layout}>
        <aside className={styles.sidebar} aria-label="Filters">
          <button
            type="button"
            className={`btn ${styles.filterToggle}`}
            aria-expanded={filtersOpen}
            aria-controls="filters-panel"
            onClick={() => setFiltersOpen((o) => !o)}
          >
            {filtersOpen ? 'Hide filters' : 'Show filters'}
          </button>
          <div id="filters-panel" className={filtersOpen ? `${styles.filters} ${styles.filtersOpen}` : styles.filters}>
            <fieldset className={styles.fieldset}>
              <legend>Category</legend>
              {categories.status === 'loading' && <p className={styles.muted}>Loading categories...</p>}
              {categories.status === 'error' && (
                <p role="alert">
                  Categories could not be loaded.{' '}
                  <button type="button" className="btn btn-small" onClick={categories.retry}>
                    Retry
                  </button>
                </p>
              )}
              {categoryNames.map((name) => (
                <div key={name} className={styles.option}>
                  <input
                    type="checkbox"
                    id={`filter-category-${name}`}
                    checked={hasCategory(filters.categories, name)}
                    onChange={() => update({ categories: toggleCategory(filters.categories, name) })}
                  />
                  <label htmlFor={`filter-category-${name}`}>{name}</label>
                </div>
              ))}
              {filters.subcategory && (
                <p className={styles.muted}>
                  Subcategory: <strong>{filters.subcategory}</strong>{' '}
                  <button type="button" className="btn btn-small" onClick={() => update({ subcategory: '' })}>
                    Clear subcategory
                  </button>
                </p>
              )}
            </fieldset>

            <form onSubmit={applyPrice} noValidate aria-label="Price filter">
              <fieldset className={styles.fieldset}>
                <legend>Price (USD)</legend>
                <div className={styles.priceRow}>
                  <div>
                    <label htmlFor="filter-min-price">Min price</label>
                    <input
                      id="filter-min-price"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      className={`control ${styles.priceInput}`}
                      value={minPrice}
                      aria-invalid={priceError ? true : undefined}
                      aria-describedby={priceError ? 'price-error' : undefined}
                      onChange={(e) => setMinPrice(e.target.value)}
                      data-testid="min-price"
                    />
                  </div>
                  <div>
                    <label htmlFor="filter-max-price">Max price</label>
                    <input
                      id="filter-max-price"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      className={`control ${styles.priceInput}`}
                      value={maxPrice}
                      aria-invalid={priceError ? true : undefined}
                      aria-describedby={priceError ? 'price-error' : undefined}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      data-testid="max-price"
                    />
                  </div>
                </div>
                {priceError && (
                  <p id="price-error" role="alert" className={styles.fieldError}>
                    {priceError}
                  </p>
                )}
                <button type="submit" className="btn btn-small">
                  Apply price
                </button>
              </fieldset>
            </form>

            <fieldset className={styles.fieldset}>
              <legend>Availability</legend>
              <div className={styles.option}>
                <input
                  type="checkbox"
                  id="filter-in-stock"
                  checked={filters.inStock}
                  onChange={(e) => update({ inStock: e.target.checked })}
                  data-testid="in-stock-toggle"
                />
                <label htmlFor="filter-in-stock">In stock only</label>
              </div>
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend>Minimum rating</legend>
              <div className={styles.option}>
                <input
                  type="radio"
                  name="rating"
                  id="filter-rating-any"
                  checked={filters.rating === null}
                  onChange={() => update({ rating: null })}
                />
                <label htmlFor="filter-rating-any">Any rating</label>
              </div>
              {RATING_OPTIONS.map((r) => (
                <div key={r} className={styles.option}>
                  <input
                    type="radio"
                    name="rating"
                    id={`filter-rating-${r}`}
                    checked={filters.rating === r}
                    onChange={() => update({ rating: r })}
                  />
                  <label htmlFor={`filter-rating-${r}`}>{pluralise(r, 'star')} &amp; up</label>
                </div>
              ))}
            </fieldset>

            <button type="button" className="btn btn-small" onClick={clearAll} disabled={!hasActiveFilters(filters)}>
              Clear all filters
            </button>
          </div>
        </aside>

        <section className={styles.results} aria-labelledby="results-heading">
          <h2 id="results-heading" className="visually-hidden">
            Results
          </h2>
          <div className={styles.toolbar}>
            <p role="status" className={styles.count} data-testid="result-count">
              {result.status === 'loading' && 'Loading...'}
              {result.status === 'success' && resultCountText(result.data, filters)}
            </p>
            <div className={styles.sort}>
              <label htmlFor="sort-select">Sort by</label>
              <select
                id="sort-select"
                className="control"
                value={filters.sort}
                onChange={(e) => update({ sort: e.target.value as SortValue })}
                data-testid="sort-select"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {result.status === 'loading' && (
            <>
              <Spinner label="Loading products" />
              <ProductGridSkeleton count={PAGE_SIZE} />
            </>
          )}

          {result.status === 'error' &&
            (result.error.status === 400 ? (
              <div>
                <ErrorState title="Those filters are not valid" message={describeFilterError(result.error)} onRetry={result.retry} />
                <button type="button" className="btn" onClick={clearAll}>
                  Clear all filters
                </button>
              </div>
            ) : (
              <ErrorState message={result.error.message} onRetry={result.retry} />
            ))}

          {result.status === 'success' && result.data.data.length > 0 && (
            <>
              <ProductGrid products={result.data.data} />
              <Pagination
                page={result.data.page}
                totalPages={totalPagesOf(result.data.total, result.data.pageSize)}
                onChange={changePage}
              />
            </>
          )}

          {result.status === 'success' && result.data.data.length === 0 && result.data.total > 0 && (
            <div className={styles.empty} data-testid="empty-state">
              <h2>No products on this page</h2>
              <p>There are only {totalPagesOf(result.data.total, result.data.pageSize)} pages of results.</p>
              <button type="button" className="btn btn-primary" onClick={() => changePage(1)}>
                Go to page 1
              </button>
            </div>
          )}

          {result.status === 'success' && result.data.total === 0 && (
            <div className={styles.empty} data-testid="empty-state">
              <h2>No products found</h2>
              <p>Nothing matches your search and filters. Try removing a filter or searching for something else.</p>
              {hasActiveFilters(filters) && (
                <button type="button" className="btn btn-primary" onClick={clearAll}>
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function resultCountText(data: ListResponse<ProductSummary>, filters: ListFilters): string {
  if (data.total === 0) return '0 products found';
  if (data.data.length === 0) return `${pluralise(data.total, 'product')} in total`;
  const from = (data.page - 1) * data.pageSize + 1;
  const to = from + data.data.length - 1;
  const scope = filters.q ? ` for “${filters.q}”` : '';
  const range = from === to ? String(from) : `${from}–${to}`;
  return `Showing ${range} of ${pluralise(data.total, 'product')}${scope}`;
}
