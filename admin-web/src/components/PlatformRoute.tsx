import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** The Super Admin pages are only for the platform operator (the API refuses everyone else too). */
export function PlatformRoute() {
  const { user } = useAuth();
  return user?.is_platform_admin ? <Outlet /> : <Navigate to="/" replace />;
}
