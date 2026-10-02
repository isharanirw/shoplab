import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { loginPathFor } from '../lib/navigation';
import { useAuth } from './AuthContext';

/** Renders child routes for logged-in users and sends everyone else to /login?next=<path>. */
export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p role="status">Loading...</p>;
  if (!user) return <Navigate to={loginPathFor(location.pathname + location.search)} replace />;
  return <Outlet />;
}
