import CheckingAccess from './CheckingAccess';
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useRole } from '../services/role';

export default function ModuleAccessGate({ permission, children }: { permission: 'attendance' | 'cashAdvances'; children: ReactNode }) {
  const { role, hasModule, isLoading } = useRole();
  if (isLoading) return <CheckingAccess />;
  if (role === 'Editor' && !hasModule(permission)) {
    const fallback = hasModule('attendance') ? '/attendance' : hasModule('cashAdvances') ? '/advances' : '/';
    return <Navigate to={fallback} replace />;
  }
  return <>{children}</>;
}
