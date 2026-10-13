// Generic Supabase access for the Sinking Fund tables (sf_*). Keys are camelCase in the app, snake_case in Postgres.
import { request } from './supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export const SF_TABLES = ['members', 'contributions', 'loans', 'payments', 'balanceDeclarations', 'auditLog', 'settings'] as const;
export type SfTable = (typeof SF_TABLES)[number];

const snake = (s: string) => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
const camel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const tbl = (t: SfTable) => 'sf_' + snake(t);
const NUM = /^(amount|lateFee|principal|monthlyRate|penaltyRate|declaredPrincipal|previousPrincipal|defaultMonthlyRate|defaultPenaltyRate|baseContribution)$/;

const fromRow = (r: Row): Row => Object.fromEntries(Object.entries(r).map(([k, v]) => {
  const c = camel(k);
  return [c, v != null && NUM.test(c) ? Number(v) : v];
}));
const toRow = (r: Row): Row => Object.fromEntries(Object.entries(r)
  .filter(([k]) => !['id', 'createdAt'].includes(k))
  .map(([k, v]) => [snake(k), v === '' || v === undefined ? null : v]));

export const sf = {
  async list(t: SfTable, limit = 5000): Promise<Row[]> {
    const order = t === 'auditLog' ? 'created_at.desc' : 'created_at.asc';
    return ((await request(`/rest/v1/${tbl(t)}?select=*&order=${order}&limit=${limit}`)) as Row[]).map(fromRow);
  },
  async get(t: SfTable, id: string | number): Promise<Row | undefined> {
    const rows = (await request(`/rest/v1/${tbl(t)}?select=*&id=eq.${encodeURIComponent(String(id))}`)) as Row[];
    return rows[0] ? fromRow(rows[0]) : undefined;
  },
  async create(t: SfTable, rec: Row): Promise<Row> {
    return fromRow(((await request(`/rest/v1/${tbl(t)}`, { method: 'POST', body: JSON.stringify(toRow(rec)) })) as Row[])[0]);
  },
  async update(t: SfTable, id: string | number, rec: Row) {
    await request(`/rest/v1/${tbl(t)}?id=eq.${encodeURIComponent(String(id))}`, { method: 'PATCH', body: JSON.stringify(toRow(rec)) });
  },
  async remove(t: SfTable, id: string) {
    await request(`/rest/v1/${tbl(t)}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  },
  async audit(action: string, entity: string, entityId: string, details: string, actor: string) {
    await request('/rest/v1/sf_audit_log', { method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ action, entity, entity_id: entityId, details, actor }) });
  },
};
