import { zite } from 'zitejs/db';
import { ZiteError } from 'zitejs/backend';
import { logFailure, throttle, RequestKind } from './guard';

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

// Accounts that are always Admin, regardless of their stored role.
const DEFAULT_ADMIN_EMAILS = ['kimsegarra516@gmail.com'];

export async function getRole(user: { id: string; email: string }): Promise<Role> {
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
  // Fail closed: never grant Admin automatically to the first account that signs up.
  return decodeRole(mine?.role).role;
}

export async function getPermissions(user: { id: string; email: string }): Promise<ModulePermission[]> {
  const mine = await zite.userRoles.findOne({ filters: { user: user.id } });
  return decodeRole(mine?.role).permissions;
}

function noSession(): never {
  throw new ZiteError({ code: 'UNAUTHORIZED', message: 'No session', userFacingMessage: 'Please sign in.' });
}

async function forbid(user: { id: string; email: string }, message: string, userFacingMessage: string): Promise<never> {
  await logFailure('Permission denied', 'FORBIDDEN', user.email, message);
  throw new ZiteError({ code: 'FORBIDDEN', message, userFacingMessage });
}

async function require(user: User, allowed: Role[], denied: string, kind: RequestKind) {
  if (!user) noSession();
  await throttle(user, kind);
  const role = await getRole(user);
  if (!allowed.includes(role)) await forbid(user, `User ${user.id} has role ${role}`, denied);
}

export const requireAdmin = (user: User, kind: RequestKind = 'write') => require(user, ['Admin'], 'Only an admin can make this change.', kind);
export const requireMember = (user: User, kind: RequestKind = 'read') => require(user, ['Admin', 'Viewer'], "You don't have access to this part of the app. Ask an admin to approve your account.", kind);

export async function requireTableAccess(user: User, table: string, action: 'read' | 'write' = 'read') {
  if (!user) noSession();
  await throttle(user, action);
  const role = await getRole(user);
  if (role === 'Admin' || (role === 'Viewer' && action === 'read')) return;
  if (role === 'Editor') {
    const permissions = await getPermissions(user);
    const allowedTable = table === 'attendance' ? permissions.includes('attendance')
      : table === 'cashAdvances' ? permissions.includes('cashAdvances')
      : table === 'employees' && action === 'read' && permissions.some((p) => p === 'attendance' || p === 'cashAdvances');
    if (allowedTable) return;
  }
  await forbid(user, `User ${user.id} lacks ${action} access to ${table}`, 'You do not have permission for this section. Ask an admin to update your access.');
}

export async function requireEditorModule(user: User, permission: ModulePermission, kind: RequestKind = 'read') {
  if (!user) noSession();
  await throttle(user, kind);
  const role = await getRole(user);
  if (role === 'Admin' || role === 'Viewer') return;
  if (role === 'Editor' && (await getPermissions(user)).includes(permission)) return;
  await forbid(user, `User ${user.id} lacks ${permission} access`, 'You do not have permission for this section. Ask an admin to update your access.');
}
