import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import styles from './AuthPages.module.css';

export function AccountPage() {
  useDocumentTitle('My account');
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  function handleLogout() {
    navigate('/', { replace: true });
    void logout();
  }

  return (
    <section className={styles.card} aria-labelledby="account-heading">
      <h1 id="account-heading">My account</h1>
      <p>
        Signed in as <strong data-testid="account-name">{user.name}</strong>
      </p>
      <dl className={styles.details}>
        <dt>Name</dt>
        <dd>{user.name}</dd>
        <dt>Email</dt>
        <dd data-testid="account-email">{user.email}</dd>
        <dt>Account type</dt>
        <dd>{user.role === 'admin' ? 'Administrator' : 'Customer'}</dd>
      </dl>
      <button type="button" className={styles.secondary} onClick={handleLogout}>
        Log out
      </button>
    </section>
  );
}
