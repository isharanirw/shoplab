import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useCart } from '../cart/CartContext';
import { CategoriesProvider } from './CategoriesContext';
import { CategoryNav } from './CategoryNav';
import { SearchBox } from './SearchBox';
import styles from './Layout.module.css';

export function Layout() {
  const { user, loading, logout } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Any navigation closes the mobile menu.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);

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
              {!loading && !user && (
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
        <main id="main" className={styles.main} tabIndex={-1}>
          <Outlet />
        </main>
        <footer className={styles.footer}>
          <nav aria-label="Footer" className={styles.footerNav}>
            <Link to="/contact" data-testid="footer-contact-link">
              Contact us
            </Link>
          </nav>
          <p data-testid="demo-notice">Demo site. No real payments or personal data.</p>
        </footer>
      </div>
    </CategoriesProvider>
  );
}
