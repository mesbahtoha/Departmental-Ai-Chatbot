import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { FullPageSpinner } from '@/components/ui/Spinner';

/** Requires an authenticated user. Redirects to /login otherwise. */
export function ProtectedRoute() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (status === 'loading') return <FullPageSpinner label="Checking session…" />;
  if (status !== 'authenticated' || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <Outlet />;
}

/** Requires an authenticated admin (role === 'admin'). */
export function AdminRoute() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (status === 'loading') return <FullPageSpinner label="Checking session…" />;
  if (status !== 'authenticated' || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (user.role !== 'admin') {
    return <Navigate to="/chat" replace />;
  }
  return <Outlet />;
}

/** Redirects authenticated users away from auth pages (login/register). */
export function PublicOnlyRoute() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  if (status === 'loading') return <FullPageSpinner label="Loading…" />;
  if (status === 'authenticated' && user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/chat'} replace />;
  }
  return <Outlet />;
}
