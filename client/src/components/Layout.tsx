import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import styles from './Layout.module.css';

export function Layout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    navigate('/', { replace: true });
    void logout();
  }

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main">
        Skip to main content
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.brand}>
            ShopLab
          </Link>
          <nav aria-label="Main" className={styles.nav}>
            <NavLink to="/" end className={styles.navLink}>
              Home
            </NavLink>
            {!loading && user && (
              <>
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
      </header>
      <main id="main" className={styles.main} tabIndex={-1}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <p data-testid="demo-notice">Demo site. No real payments or personal data.</p>
      </footer>
    </div>
  );
}
