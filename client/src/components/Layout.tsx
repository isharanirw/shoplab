import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useCart } from '../cart/CartContext';
import { CategoriesProvider } from './CategoriesContext';
import { CategoryNav } from './CategoryNav';
import { CookieBanner } from './CookieBanner';
import { ErrorBoundary } from './ErrorBoundary';
import { SearchBox } from './SearchBox';
import { ShippingTo } from './ShippingTo';
import styles from './Layout.module.css';

export function Layout() {
  const { user, loading, logout, checkError, retryCheck } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const firstPath = useRef(true);

  // Any navigation closes the mobile menu.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  // After a client-side page change, move focus to the page content so keyboard and screen reader users
  // start at the top of the new page (a full page load already does this). A page that placed focus itself keeps it.
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    const main = mainRef.current;
    const active = document.activeElement;
    if (!main || (active && active !== document.body && main.contains(active))) return;
    main.focus({ preventScroll: true });
  }, [location.pathname]);

  function handleLogout() {
    navigate('/', { replace: true });
    void logout();
  }

  return (
    <CategoriesProvider>
      <div className={styles.shell}>
        <a className={styles.skipLink} href="#main">
          Skip to main content
        </a>
        <header className={styles.header}>
          <div className={styles.topBar}>
            <ShippingTo />
          </div>
          <div className={styles.headerInner}>
            <button
              type="button"
              className={`btn btn-small ${styles.menuButton}`}
              aria-expanded={menuOpen}
              aria-controls="category-menu"
              onClick={() => setMenuOpen((open) => !open)}
              data-testid="menu-toggle"
            >
              <span aria-hidden="true">☰</span> Menu
            </button>
            <Link to="/" className={styles.brand}>
              ShopLab
            </Link>
            <div className={styles.search}>
              <SearchBox />
            </div>
            <nav aria-label="Account" className={styles.account}>
              <NavLink to="/cart" className={styles.navLink} aria-label={`Cart, ${cart.count} ${cart.count === 1 ? 'item' : 'items'}`}>
                Cart{' '}
                <span className={styles.badge} data-testid="cart-badge" aria-hidden="true">
                  {cart.count}
                </span>
              </NavLink>
              {!loading && user && (
                <>
                  {user.role === 'admin' && (
                    <NavLink to="/admin" className={styles.navLink} data-testid="admin-link">
                      Admin
                    </NavLink>
                  )}
                  <NavLink to="/wishlist" className={styles.navLink}>
                    Wishlist
                  </NavLink>
                  <NavLink to="/account" className={styles.navLink}>
                    My account
                  </NavLink>
                  <button type="button" className={styles.linkButton} onClick={handleLogout}>
                    Log out
                  </button>
                </>
              )}
              {!loading && !user && checkError && (
                <>
                  <span>Could not check your login.</span>
                  <button type="button" className={styles.linkButton} onClick={retryCheck}>
                    Retry
                  </button>
                </>
              )}
              {!loading && !user && !checkError && (
                <>
                  <NavLink to="/login" className={styles.navLink}>
                    Log in
                  </NavLink>
                  <NavLink to="/register" className={styles.navLink}>
                    Register
                  </NavLink>
                </>
              )}
            </nav>
          </div>
          <div className={styles.categoryBar}>
            <nav
              id="category-menu"
              aria-label="Categories"
              className={menuOpen ? `${styles.categoryNav} ${styles.categoryNavOpen}` : styles.categoryNav}
            >
              <CategoryNav onNavigate={() => setMenuOpen(false)} />
            </nav>
          </div>
        </header>
        <main id="main" ref={mainRef} className={styles.main} tabIndex={-1}>
          <ErrorBoundary key={`${location.pathname}${location.search}`}>
            <Outlet />
          </ErrorBoundary>
        </main>
        <footer className={styles.footer}>
          <nav aria-label="Footer" className={styles.footerNav}>
            <Link to="/about">About</Link>
            {' · '}
            <Link to="/terms">Terms</Link>
            {' · '}
            <Link to="/contact" data-testid="footer-contact-link">
              Contact us
            </Link>
          </nav>
          <p data-testid="demo-notice">Demo site. No real payments or personal data.</p>
          <button type="button" className={styles.backToTop} onClick={() => window.scrollTo({ top: 0 })}>
            <svg viewBox="0 0 24 24" width="18" height="18" focusable="false">
              <path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </footer>
        <CookieBanner />
      </div>
    </CategoriesProvider>
  );
}
