import { Link, useNavigate } from 'react-router-dom';
import { AddressBook } from '../account/AddressBook';
import { ProfileSection } from '../account/ProfileSection';
import accountStyles from '../account/Account.module.css';
import { useAuth } from '../auth/AuthContext';
import { useDocumentTitle } from '../lib/useDocumentTitle';

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
    <div>
      <h1>My account</h1>
      <ul className={accountStyles.links}>
        <li>
          <Link to="/account/orders" data-testid="orders-link">
            Order history
          </Link>
        </li>
        <li>
          <Link to="/wishlist">Wishlist</Link>
        </li>
      </ul>
      <ProfileSection />
      <AddressBook />
      <button type="button" className="btn" onClick={handleLogout}>
        Log out
      </button>
    </div>
  );
}
