import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ForbiddenPage } from '../pages/ForbiddenPage';
import { loginPathFor } from '../lib/navigation';
import { useAuth } from './AuthContext';
import { ErrorState, Spinner } from '../components/Feedback';

/**
 * Guards the admin area: logged-out visitors go to /login?next=<path>, logged-in customers see the 403 page,
 * and admins see the child routes.
 */
export function AdminRoute() {
  const { user, loading, checkError, retryCheck } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner label="Loading" />;
  if (checkError) return <ErrorState message={checkError} onRetry={retryCheck} />;
  if (!user) return <Navigate to={loginPathFor(location.pathname + location.search)} replace />;
  if (user.role !== 'admin') return <ForbiddenPage />;
  return <Outlet />;
}
