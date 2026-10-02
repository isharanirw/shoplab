import { NavLink, Outlet } from 'react-router-dom';
import styles from './Admin.module.css';

const LINKS = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/products', label: 'Products', end: false },
  { to: '/admin/orders', label: 'Orders', end: false },
  { to: '/admin/users', label: 'Users', end: false },
];

/** The frame of every admin page: a simple navigation bar above the page itself (each page has its own h1). */
export function AdminLayout() {
  return (
    <div data-testid="admin-area">
      <nav aria-label="Admin">
        <ul className={styles.nav}>
          {LINKS.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                end={link.end}
                className={({ isActive }) => (isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink)}
                data-testid={`admin-nav-${link.label.toLowerCase()}`}
              >
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Outlet />
    </div>
  );
}
