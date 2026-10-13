import { useQuery } from '@tanstack/react-query';
import { getMyRole } from 'zitejs/api';

export function useRole() {
  const { data, isLoading } = useQuery({ queryKey: ['myRole'], queryFn: () => getMyRole({}), staleTime: 5 * 60_000 });
  const role = data?.role ?? 'None';
  const permissions = data?.permissions ?? [];
  return {
    role,
    permissions,
    isAdmin: role === 'Admin',
    isEditor: role === 'Editor',
    canEditTable: (table: string) => role === 'Admin' || (role === 'Editor' && (table === 'attendance' ? permissions.includes('attendance') : table === 'cashAdvances' ? permissions.includes('cashAdvances') : false)),
    hasModule: (permission: 'attendance' | 'cashAdvances') => role === 'Admin' || role === 'Viewer' || (role === 'Editor' && permissions.includes(permission)),
    isLoading,
  };
}
