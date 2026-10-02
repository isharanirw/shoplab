import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import styles from './HomePage.module.css';

export function HomePage() {
  useDocumentTitle('');
  const { user } = useAuth();
  return (
    <section className={styles.hero} aria-labelledby="home-heading">
      <h1 id="home-heading">Welcome to ShopLab</h1>
      <p>
        ShopLab is a demo online store built for practising test automation. This is a placeholder home page: the
        catalogue, cart and checkout arrive in later build phases.
      </p>
      {user ? (
        <p>
          You are signed in as {user.name}. Go to <Link to="/account">your account</Link>.
        </p>
      ) : (
        <p>
          <Link to="/login">Log in</Link> or <Link to="/register">create an account</Link> to get started.
        </p>
      )}
    </section>
  );
}
