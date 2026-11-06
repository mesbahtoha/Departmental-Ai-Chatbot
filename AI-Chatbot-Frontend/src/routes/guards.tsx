import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { FullPageSpinner } from '@/components/ui/Spinner';

function useAuthReady() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  return { status, user, location };
}

/** Requires an authenticated user. Redirects to /login otherwise. */
export function ProtectedRoute() {
  const { status, user } = useAuthReady();

  if (status === 'loading') return <FullPageSpinner label="Checking session…" />;
  if (status !== 'authenticated' || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <Outlet />;
}

/** Requires a platform owner (Super Admin / Admin). */
export function AdminRoute() {
  const { status, user } = useAuthReady();

  if (status === 'loading') return <FullPageSpinner label="Checking session…" />;
  if (status !== 'authenticated' || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (user.role !== 'admin' && user.role !== 'superadmin') {
    return <Navigate to="/chat" replace />;
  }
  return <Outlet />;
}

/** Requires a school-level administrator. */
export function SchoolAdminRoute() {
  const { status, user } = useAuthReady();

  if (status === 'loading') return <FullPageSpinner label="Checking session…" />;
  if (status !== 'authenticated' || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (user.role !== 'school_admin') {
    return <Navigate to={defaultHomeFor(user.role)} replace />;
  }
  return <Outlet />;
}

/** Requires a teacher. */
export function TeacherRoute() {
  const { status, user } = useAuthReady();

  if (status === 'loading') return <FullPageSpinner label="Checking session…" />;
  if (status !== 'authenticated' || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (user.role !== 'teacher') {
    return <Navigate to={defaultHomeFor(user.role)} replace />;
  }
  return <Outlet />;
}

/** Requires a learner (student / legacy user). */
export function StudentRoute() {
  const { status, user } = useAuthReady();

  if (status === 'loading') return <FullPageSpinner label="Checking session…" />;
  if (status !== 'authenticated' || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (user.role !== 'student' && user.role !== 'user') {
    return <Navigate to={defaultHomeFor(user.role)} replace />;
  }
  return <Outlet />;
}

/** Any authenticated user may open the chat / tutor app. */
export function AnyAuthRoute() {
  const { status, user } = useAuthReady();

  if (status === 'loading') return <FullPageSpinner label="Checking session…" />;
  if (status !== 'authenticated' || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <Outlet />;
}

function defaultHomeFor(role?: string | null): string {
  switch (role) {
    case 'superadmin':
    case 'admin':
      return '/admin';
    case 'school_admin':
      return '/school';
    case 'teacher':
      return '/teacher';
    case 'student':
    case 'user':
    default:
      return '/chat';
  }
}

/** Redirects authenticated users away from auth pages (login/register). */
export function PublicOnlyRoute() {
  const { status, user } = useAuthReady();

  if (status === 'loading') return <FullPageSpinner label="Loading…" />;
  if (status === 'authenticated' && user) {
    return <Navigate to={defaultHomeFor(user.role)} replace />;
  }
  return <Outlet />;
}
