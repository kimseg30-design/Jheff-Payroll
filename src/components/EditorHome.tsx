import { Navigate } from 'react-router-dom';
import { useRole } from '../services/role';
import DashboardPage from '../pages/DashboardPage';

export default function EditorHome() {
  const { role, hasModule, isLoading } = useRole();
  if (isLoading) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Checking access…</div>;
  if (role === 'Editor') {
    if (hasModule('attendance')) return <Navigate to="/attendance" replace />;
    if (hasModule('cashAdvances')) return <Navigate to="/advances" replace />;
  }
  return <DashboardPage />;
}
