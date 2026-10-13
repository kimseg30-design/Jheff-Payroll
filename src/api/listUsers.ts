import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdmin } from '../lib/roles';

function parseRole(raw: unknown): { role: 'Admin' | 'Viewer' | 'Editor' | 'None'; permissions: ('attendance' | 'cashAdvances')[] } {
  const [base, encoded = ''] = String(raw ?? 'None').split('|', 2);
  const role = (base === 'Admin' || base === 'Viewer' || base === 'Editor' ? base : 'None') as 'Admin' | 'Viewer' | 'Editor' | 'None';
  const permissions = encoded.split(',').filter((p): p is 'attendance' | 'cashAdvances' => p === 'attendance' || p === 'cashAdvances');
  return { role, permissions: role === 'Editor' ? [...new Set(permissions)] : [] };
}

export default createEndpoint({
  authenticated: true,
  description: 'Lists app users, roles, and module permissions (admins only)',
  inputSchema: z.object({}),
  outputSchema: z.object({ users: z.array(z.object({
    id: z.string(), name: z.string(), email: z.string(),
    role: z.enum(['Admin', 'Viewer', 'Editor', 'None']),
    permissions: z.array(z.enum(['attendance', 'cashAdvances'])),
  })) }),
  execute: async ({ context }) => {
    await requireAdmin(context.user);
    const [users, roles] = await Promise.all([
      zite.auth.findAllUsers({ appIds: ['cfalkekpn2'], sort: [{ field: 'email', direction: 'asc' }], limit: 500 }),
      zite.userRoles.findAll({ limit: 2000 }),
    ]);
    const roleOf = new Map(roles.records.map((r) => [Array.isArray(r.user) ? r.user[0] : r.user, parseRole(r.role)]));
    return {
      users: users.records.map((u) => {
        const access = roleOf.get(u.id) ?? { role: 'None' as const, permissions: [] as ('attendance' | 'cashAdvances')[] };
        return { id: u.id, name: u.name || u.email, email: u.email, role: access.role, permissions: access.permissions };
      }),
    };
  },
});
