import { zite } from 'zitejs/db';
import { ZiteError } from 'zitejs/backend';

export type ModulePermission = 'attendance' | 'cashAdvances';
export type Role = 'Admin' | 'Viewer' | 'Editor' | 'None';
type User = { id: string; email: string } | null | undefined;

function decodeRole(raw: unknown): { role: Role; permissions: ModulePermission[] } {
  const value = String(raw ?? 'None');
  const [base, encoded = ''] = value.split('|', 2);
  const role: Role = base === 'Admin' || base === 'Viewer' || base === 'Editor' ? base : 'None';
  const valid = encoded.split(',').filter((p): p is ModulePermission => p === 'attendance' || p === 'cashAdvances');
  return { role, permissions: role === 'Editor' ? [...new Set(valid)] : [] };
}

// Per-user request throttle (per server instance): 300 role checks per minute.
const RATE_LIMIT = 300;
const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();
function rateLimit(userId: string) {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    throw new ZiteError({ code: 'RATE_LIMITED', message: `Rate limit exceeded for ${userId}`, userFacingMessage: 'Too many requests. Please wait a minute and try again.' });
  }
  recent.push(now);
  hits.set(userId, recent);
  if (hits.size > 5000) hits.clear();
}

// Accounts that are always Admin, regardless of their stored role.
const DEFAULT_ADMIN_EMAILS = ['kimsegarra516@gmail.com'];

export async function getRole(user: { id: string; email: string }): Promise<Role> {
  rateLimit(user.id);
  if (DEFAULT_ADMIN_EMAILS.includes(user.email.trim().toLowerCase())) return 'Admin';
  const mine = await zite.userRoles.findOne({ filters: { user: user.id } });
  if (!mine) {
    // First sign-in of an invited user: turn the invite into their role.
    const invite = await zite.appInvites.findOne({ filters: { email: user.email.trim().toLowerCase() } });
    if (invite?.role) {
      await zite.userRoles.bulkCreate({ records: [{ label: user.email, user: user.id, role: invite.role }], matchOn: ['user'] });
      await zite.appInvites.delete({ id: invite.id });
      return decodeRole(invite.role).role;
    }
  }
  const decoded = decodeRole(mine?.role);
  // Fail closed: never grant Admin automatically to the first account that signs up.
  // Bootstrap the initial administrator manually in the trusted workspace database.
  return decoded.role;
}

export async function getPermissions(user: { id: string; email: string }): Promise<ModulePermission[]> {
  const mine = await zite.userRoles.findOne({ filters: { user: user.id } });
  return decodeRole(mine?.role).permissions;
}

async function require(user: User, allowed: Role[], denied: string) {
  if (!user) throw new ZiteError({ code: 'UNAUTHORIZED', message: 'No session', userFacingMessage: 'Please sign in.' });
  const role = await getRole(user);
  if (!allowed.includes(role)) {
    throw new ZiteError({ code: 'FORBIDDEN', message: `User ${user.id} has role ${role}`, userFacingMessage: denied });
  }
}

export const requireAdmin = (user: User) => require(user, ['Admin'], 'Only an admin can make this change.');
export const requireMember = (user: User) => require(user, ['Admin', 'Viewer'], "You don't have access to this part of the app. Ask an admin to approve your account.");

export async function requireTableAccess(user: User, table: string, action: 'read' | 'write' = 'read') {
  if (!user) throw new ZiteError({ code: 'UNAUTHORIZED', message: 'No session', userFacingMessage: 'Please sign in.' });
  const role = await getRole(user);
  if (role === 'Admin' || (role === 'Viewer' && action === 'read')) return;
  if (role === 'Editor') {
    const permissions = await getPermissions(user);
    const allowedTable = table === 'attendance' ? permissions.includes('attendance')
      : table === 'cashAdvances' ? permissions.includes('cashAdvances')
      : table === 'employees' && action === 'read' && permissions.some((p) => p === 'attendance' || p === 'cashAdvances');
    if (allowedTable) return;
  }
  throw new ZiteError({ code: 'FORBIDDEN', message: `User ${user.id} lacks ${action} access to ${table}`, userFacingMessage: 'You do not have permission for this section. Ask an admin to update your access.' });
}

export async function requireEditorModule(user: User, permission: ModulePermission) {
  if (!user) throw new ZiteError({ code: 'UNAUTHORIZED', message: 'No session', userFacingMessage: 'Please sign in.' });
  const role = await getRole(user);
  if (role === 'Admin' || role === 'Viewer') return;
  if (role === 'Editor' && (await getPermissions(user)).includes(permission)) return;
  throw new ZiteError({ code: 'FORBIDDEN', message: `User ${user.id} lacks ${permission} access`, userFacingMessage: 'You do not have permission for this section. Ask an admin to update your access.' });
}
