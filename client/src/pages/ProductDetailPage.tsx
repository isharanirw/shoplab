import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ListResponse, ProductDetail, Review } from '../api/types';
import { ErrorState, Spinner } from '../components/Feedback';
import { Pagination } from '../components/Pagination';
import { Price } from '../components/Price';
import { ProductImage } from '../components/ProductImage';
import { PurchasePanel } from '../components/PurchasePanel';
import { StarRating } from '../components/StarRating';
import { useFetch } from '../hooks/useFetch';
import { categoryHref } from '../components/CategoryNav';
import { formatDate, pluralise } from '../lib/format';
import { totalPagesOf } from '../lib/pagination';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import styles from './ProductDetailPage.module.css';

type TabId = 'description' | 'specs' | 'reviews';

const TABS: { id: TabId; label: string }[] = [
  { id: 'description', label: 'Description' },
  { id: 'specs', label: 'Specs' },
  { id: 'reviews', label: 'Reviews' },
];

export function ProductDetailPage() {
  const { id } = useParams();
  const validId = id !== undefined && /^[1-9]\d{0,8}$/.test(id);
  const result = useFetch<ProductDetail>(validId ? `/api/products/${id}` : null);

  if (!validId) return <ProductNotFound />;
  if (result.status === 'loading') {
    return (
      <div>
        <h1 className="visually-hidden">Product details</h1>
        <Spinner label="Loading product" />
      </div>
    );
  }
  if (result.status === 'error') {
    if (result.error.status === 404) return <ProductNotFound />;
    return (
      <div>
        <h1 className="visually-hidden">Product details</h1>
        <ErrorState message={result.error.message} onRetry={result.retry} />
      </div>
    );
  }
  return <ProductView key={result.data.id} product={result.data} />;
}

function ProductNotFound() {
  useDocumentTitle('Product not found');
  return (
    <section aria-labelledby="not-found-heading" data-testid="product-not-found">
      <h1 id="not-found-heading">Product not found</h1>
      <p>We could not find that product. It may have been removed.</p>
      <p>
        <Link to="/products">Browse all products</Link>
      </p>
    </section>
  );
}

function ProductView({ product }: { product: ProductDetail }) {
  useDocumentTitle(product.name);
  const [imageIndex, setImageIndex] = useState(0);
  const [tab, setTab] = useState<TabId>('description');
  const count = Math.max(product.imageCount, 1);

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const current = TABS.findIndex((t) => t.id === tab);
    let next = current;
    if (event.key === 'ArrowRight') next = (current + 1) % TABS.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + TABS.length) % TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TABS.length - 1;
    else return;
    const target = TABS[next];
    if (!target) return;
    event.preventDefault();
    setTab(target.id);
    document.getElementById(`tab-${target.id}`)?.focus();
  }

  return (
    <article>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link to="/products">Products</Link> / <Link to={categoryHref(product.category)}>{product.category}</Link>
      </nav>

      <div className={styles.top}>
        <div className={styles.gallery}>
          <div className={styles.main} data-testid="gallery-main">
            <ProductImage key={imageIndex} productId={product.id} name={product.name} index={imageIndex} total={count} />
          </div>
          <ul className={styles.thumbs} aria-label="Product images">
            {Array.from({ length: count }, (_, i) => (
              <li key={i}>
                <button
                  type="button"
                  className={i === imageIndex ? `${styles.thumb} ${styles.thumbActive}` : styles.thumb}
                  aria-label={`Show image ${i + 1} of ${count}`}
                  aria-pressed={i === imageIndex}
                  onClick={() => setImageIndex(i)}
                  data-testid={`gallery-thumb-${i + 1}`}
                >
                  <ProductImage productId={product.id} name={product.name} index={i} total={count} decorative />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.info}>
          <h1 className={styles.title}>{product.name}</h1>
          <p className={styles.meta}>
            {product.category} / {product.subcategory}
          </p>
          <p className={styles.price}>
            <Price priceCents={product.priceCents} salePriceCents={product.salePriceCents} />
          </p>
          <p className={styles.rating}>
            <StarRating rating={product.rating} showCount={false} />{' '}
            {product.rating.count > 0 && (
              <button type="button" className={styles.linkButton} onClick={() => setTab('reviews')}>
                {pluralise(product.rating.count, 'review')}
              </button>
            )}
          </p>
          <PurchasePanel product={product} idPrefix="pd" />
        </div>
      </div>

      <section className={styles.tabs} aria-label="Product information">
        <div role="tablist" aria-label="Product information" className={styles.tabList}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              className={tab === t.id ? `${styles.tab} ${styles.tabActive}` : styles.tab}
              onClick={() => setTab(t.id)}
              onKeyDown={onTabKeyDown}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className={styles.panel} tabIndex={0}>
          {tab === 'description' && (
            <>
              <h2>Description</h2>
              <p>{product.description}</p>
            </>
          )}
          {tab === 'specs' && (
            <>
              <h2>Specifications</h2>
              {product.specs.length === 0 ? (
                <p>No specifications are listed for this product.</p>
              ) : (
                <table className={styles.specs}>
                  <tbody>
                    {product.specs.map((s) => (
                      <tr key={s.label}>
                        <th scope="row">{s.label}</th>
                        <td>{s.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
          {tab === 'reviews' && <ReviewsTab product={product} />}
        </div>
      </section>
    </article>
  );
}

const REVIEW_SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'highest', label: 'Highest rated' },
  { value: 'lowest', label: 'Lowest rated' },
] as const;

function ReviewsTab({ product }: { product: ProductDetail }) {
  const [sort, setSort] = useState<(typeof REVIEW_SORTS)[number]['value']>('newest');
  const [page, setPage] = useState(1);
  const result = useFetch<ListResponse<Review>>(`/api/products/${product.id}/reviews?sort=${sort}&page=${page}`);

  return (
    <>
      <h2>Customer reviews</h2>
      <div className={styles.summary} data-testid="rating-summary">
        <StarRating rating={product.rating} showCount={false} />{' '}
        {product.rating.average !== null && (
          <span>
            out of 5, {pluralise(product.rating.count, 'review')}
          </span>
        )}
      </div>
      {product.rating.count > 0 && (
        <ul className={styles.distribution} aria-label="Reviews by rating">
          {([5, 4, 3, 2, 1] as const).map((n) => (
            <li key={n}>
              {pluralise(n, 'star')}: {product.ratingDistribution[String(n) as '1' | '2' | '3' | '4' | '5']}
            </li>
          ))}
        </ul>
      )}

      {product.rating.count > 0 && (
        <div className={styles.sortRow}>
          <label htmlFor="review-sort">Sort reviews</label>
          <select
            id="review-sort"
            className="control"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as typeof sort);
              setPage(1);
            }}
            data-testid="review-sort"
          >
            {REVIEW_SORTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {result.status === 'loading' && <Spinner label="Loading reviews" />}
      {result.status === 'error' && <ErrorState message={result.error.message} onRetry={result.retry} />}
      {result.status === 'success' && result.data.total === 0 && <p data-testid="no-reviews">There are no reviews for this product yet.</p>}
      {result.status === 'success' && result.data.total > 0 && (
        <>
          <ul className={styles.reviews} data-testid="review-list">
            {result.data.data.map((r) => (
              <li key={r.id} className={styles.review}>
                <article aria-labelledby={`review-title-${r.id}`}>
                  <p className={styles.reviewHead}>
                    <StarRating rating={{ average: r.rating, count: 1 }} showCount={false} ariaLabel={`${r.rating} out of 5 stars`} />
                  </p>
                  <h3 id={`review-title-${r.id}`} className={styles.reviewTitle}>
                    {r.title}
                  </h3>
                  <p className={styles.reviewMeta}>
                    {r.authorName} on {formatDate(r.createdAt)}
                  </p>
                  <p>{r.body}</p>
                </article>
              </li>
            ))}
          </ul>
          <Pagination
            label="Reviews pagination"
            page={result.data.page}
            totalPages={totalPagesOf(result.data.total, result.data.pageSize)}
            onChange={setPage}
          />
        </>
      )}
    </>
  );
}
