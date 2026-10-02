import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ListResponse, ProductSummary, Promotions } from '../api/types';
import { useCategories } from '../components/CategoriesContext';
import { categoryHref } from '../components/CategoryNav';
import { ErrorState, Spinner } from '../components/Feedback';
import { ProductGrid, ProductGridSkeleton } from '../components/ProductGrid';
import { useFetch } from '../hooks/useFetch';
import { formatCountdown, secondsRemaining } from '../lib/flashSale';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import styles from './HomePage.module.css';

/** Counts down to the next 00:00:00 UTC and updates once a second, on the second. */
function Countdown() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timer: number;
    function tick() {
      setNow(Date.now());
      timer = window.setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
    }
    timer = window.setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
    return () => window.clearTimeout(timer);
  }, []);
  const text = formatCountdown(secondsRemaining(new Date(now)));
  return (
    <p className={styles.countdown} role="timer" data-testid="flash-sale-countdown">
      <span>Ends in </span>
      <time>{text}</time>
    </p>
  );
}

export function HomePage() {
  useDocumentTitle('');
  const navigate = useNavigate();
  const promotions = useFetch<Promotions>('/api/promotions');
  const categories = useCategories();
  const featured = useFetch<ListResponse<ProductSummary>>('/api/products?featured=true&pageSize=8');

  return (
    <div>
      <section className={styles.hero} aria-labelledby="home-heading">
        <h1 id="home-heading">Welcome to ShopLab</h1>
        {promotions.status === 'loading' && <Spinner label="Loading offers" />}
        {promotions.status === 'error' && <ErrorState message={promotions.error.message} onRetry={promotions.retry} />}
        {promotions.status === 'success' && (
          <div className={styles.bannerClick} onClick={() => navigate('/products')}>
            <p className={styles.banner} data-testid="hero-banner-text">
              {promotions.data.bannerText}
            </p>
          </div>
        )}
        <Link to="/products" className="btn btn-primary">
          Shop all products
        </Link>
      </section>

      <section className={styles.flash} aria-labelledby="flash-heading">
        <h2 id="flash-heading">{promotions.status === 'success' ? promotions.data.flashSaleLabel : 'Flash sale'}</h2>
        <Countdown />
      </section>

      <section className={styles.section} aria-labelledby="shop-by-category">
        <h2 id="shop-by-category">Shop by category</h2>
        {categories.status === 'loading' && <Spinner label="Loading categories" />}
        {categories.status === 'error' && <ErrorState message={categories.error.message} onRetry={categories.retry} />}
        {categories.status === 'success' && (
          <ul className={styles.categoryList} data-testid="category-links">
            {categories.data.data.map((c) => (
              <li key={c.name}>
                <Link to={categoryHref(c.name)} className={styles.categoryLink}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section} aria-labelledby="featured-heading">
        <h2 id="featured-heading">Featured products</h2>
        {featured.status === 'loading' && (
          <>
            <Spinner label="Loading featured products" />
            <ProductGridSkeleton count={4} />
          </>
        )}
        {featured.status === 'error' && <ErrorState message={featured.error.message} onRetry={featured.retry} />}
        {featured.status === 'success' && <ProductGrid products={featured.data.data} />}
      </section>
    </div>
  );
}
