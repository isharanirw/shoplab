import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { loginPathFor } from '../lib/navigation';
import { useAuth } from './AuthContext';
import { ErrorState, Spinner } from '../components/Feedback';

/** Renders child routes for logged-in users and sends everyone else to /login?next=<path>. */
export function ProtectedRoute() {
  const { user, loading, checkError, retryCheck } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner label="Loading" />;
  if (checkError) return <ErrorState message={checkError} onRetry={retryCheck} />;
  if (!user) return <Navigate to={loginPathFor(location.pathname + location.search)} replace />;
  return <Outlet />;
}
