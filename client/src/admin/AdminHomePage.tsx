import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import styles from './Admin.module.css';

/** /admin: a short overview that links to the three admin views. */
export function AdminHomePage() {
  useDocumentTitle('Admin');
  return (
    <section aria-labelledby="admin-heading">
      <h1 id="admin-heading">Admin panel</h1>
      <p>Manage the catalogue, customer orders and user accounts.</p>
      <div className={styles.cards}>
        <div className={styles.card}>
          <h2>Products</h2>
          <p>Search, add, edit, deactivate and delete products, and upload their pictures.</p>
          <Link to="/admin/products">Manage products</Link>
        </div>
        <div className={styles.card}>
          <h2>Orders</h2>
          <p>See every customer order and change its status.</p>
          <Link to="/admin/orders">Manage orders</Link>
        </div>
        <div className={styles.card}>
          <h2>Users</h2>
          <p>See all accounts and lock or unlock them.</p>
          <Link to="/admin/users">Manage users</Link>
        </div>
      </div>
    </section>
  );
}
