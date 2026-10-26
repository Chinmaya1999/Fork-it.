import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth(); const loc = useLocation();
  if (loading) return <div className="mx-auto max-w-3xl p-10"><Skeleton className="h-40" /></div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return <>{children}</>;
}
