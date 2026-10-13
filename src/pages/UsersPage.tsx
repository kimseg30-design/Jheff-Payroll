import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listUsers, setUserRole } from 'zitejs/api';
import { toast } from 'sonner';
import { useAuth } from 'zitejs/auth';
import { Navigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Checkbox } from '@project/components/ui/checkbox';
import { Skeleton } from '@project/components/ui/skeleton';
import { Card } from '@project/components/ui/card';
import { Badge } from '@project/components/ui/badge';
import PageHeader from '../components/PageHeader';
import AddUserDialog from '../components/AddUserDialog';
import PendingInvites from '../components/PendingInvites';
import { useRole } from '../services/role';

type AppRole = 'Admin' | 'Viewer' | 'Editor' | 'None';
type Permission = 'attendance' | 'cashAdvances';

export default function UsersPage() {
  const { isAdmin, isLoading: roleLoading } = useRole();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => listUsers({}), enabled: isAdmin });
  const change = useMutation({
    mutationFn: setUserRole,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['users'] });
      await qc.invalidateQueries({ queryKey: ['myRole'] });
      toast.success('Access settings saved. Ask the user to log out and sign in again.');
    },
    onError: (e: Error) => toast.error(e.message || 'Could not update access'),
  });

  const updateRole = (u: NonNullable<typeof data>['users'][number], role: AppRole) => {
    const permissions: Permission[] = role === 'Editor'
      ? (u.role === 'Editor' && u.permissions.length ? u.permissions : ['attendance', 'cashAdvances'])
      : [];
    change.mutate({ userId: u.id, email: u.email, role, permissions });
  };

  const togglePermission = (u: NonNullable<typeof data>['users'][number], permission: Permission, checked: boolean) => {
    const permissions = checked
      ? [...new Set([...u.permissions, permission])]
      : u.permissions.filter((p) => p !== permission);
    change.mutate({ userId: u.id, email: u.email, role: 'Editor', permissions });
  };

  if (!roleLoading && !isAdmin) return <Navigate to="/" replace />;

  return (
    <div>
      <PageHeader title="Users & Roles" description="Choose each user's role and, for Editors, exactly which modules they can open. Changes are enforced in the app and backend." actions={<AddUserDialog />} />
      <div className="mb-5 rounded-xl border bg-muted/30 p-4 text-sm">
        <div className="font-semibold">How access works</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li><b className="text-foreground">Admin:</b> full access, including user and permission management.</li>
          <li><b className="text-foreground">Viewer:</b> view-only access to the existing app modules.</li>
          <li><b className="text-foreground">Editor:</b> only the modules checked below; can create, edit, and delete records in those modules.</li>
          <li>After changing permissions, the user should sign out and sign in again to refresh access.</li>
        </ul>
      </div>
      <PendingInvites />
      <Card className="divide-y">
        {isLoading || roleLoading ? [0, 1, 2].map((i) => <div key={i} className="p-4"><Skeleton className="h-6 w-1/2" /></div>) :
          data?.users.map((u) => (
            <div key={u.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 lg:flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="truncate font-medium">{u.name}{u.id === user?.id && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}</div>
                  <Badge variant={u.role === 'Admin' ? 'default' : 'secondary'}>{u.role}</Badge>
                </div>
                <div className="truncate text-sm text-muted-foreground">{u.email}</div>
              </div>
              <div className="flex flex-col gap-3 lg:w-[420px]">
                <Select value={u.role} disabled={change.isPending} onValueChange={(role) => updateRole(u, role as AppRole)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin — Full access</SelectItem>
                    <SelectItem value="Viewer">Viewer — View only</SelectItem>
                    <SelectItem value="Editor">Editor — Selected modules</SelectItem>
                    <SelectItem value="None">No access</SelectItem>
                  </SelectContent>
                </Select>
                {u.role === 'Editor' && (
                  <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox checked={u.permissions.includes('attendance')} disabled={change.isPending} onCheckedChange={(v) => togglePermission(u, 'attendance', !!v)} />
                      Attendance
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox checked={u.permissions.includes('cashAdvances')} disabled={change.isPending} onCheckedChange={(v) => togglePermission(u, 'cashAdvances', !!v)} />
                      Cash Advances
                    </label>
                    <p className="text-xs text-muted-foreground sm:col-span-2">Only checked modules appear in the menu. Employee names are available only to support these modules.</p>
                  </div>
                )}
              </div>
            </div>
          ))}
      </Card>
    </div>
  );
}
