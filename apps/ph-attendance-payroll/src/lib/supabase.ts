// Thin Supabase (PostgREST) client that keeps the same shape the app already used:
// camelCase fields, link fields as [id] arrays, findAll/findOne/create/update/delete/bulkCreate.
import { ZiteError } from 'zitejs/backend';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = Record<string, any>;

const LINKS: Record<string, string> = { employee: 'employee_id', department: 'department_id' };
const COLUMNS: Record<string, string[]> = {
  departments: ['departmentName', 'description'],
  employees: ['fullName', 'employeeNo', 'position', 'department', 'dailyRate', 'employmentStatus', 'dateHired', 'tin', 'sssNo', 'philHealthNo', 'pagIbigNo', 'leaveCredits', 'active'],
  attendance: ['workDate', 'employee', 'timeIn', 'timeOut', 'status', 'dayType', 'lateMinutes', 'overtimeHours', 'overtimePayMode', 'overtimeAmount', 'otherBenefit', 'nightDiffHours', 'remarks'],
  leaves: ['leaveReason', 'employee', 'leaveType', 'startDate', 'endDate', 'days', 'status'],
  cashAdvances: ['description', 'employee', 'type', 'amount', 'deductionPerCutoff', 'balance', 'dateGranted', 'status'],
  payslips: ['periodLabel', 'employee', 'periodStart', 'periodEnd', 'daysWorked', 'basicPay', 'overtimePay', 'otherBenefits', 'nightDiffPay', 'holidayPay', 'lateDeduction', 'grossPay', 'sss', 'philHealth', 'pagIbig', 'withholdingTax', 'loanDeductions', 'cashAdvanceDeduction', 'sinkingContributionDeduction', 'netPay', 'status', 'deductionDetails'],
};
const NUMERIC = /Rate|Credits|Minutes|Hours|Amount|Benefit|Benefits|^days|Pay$|Deduction$|^amount$|^balance$|^sss$|^philHealth$|^pagIbig$|Tax$|Deductions$|PerCutoff$/;

const snake = (s: string) => LINKS[s] ?? s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
const camel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const tableName = (t: string) => snake(t);

function toRow(table: string, rec: Rec): Rec {
  const row: Rec = {};
  for (const key of COLUMNS[table]) {
    if (!(key in rec)) continue;
    let v = rec[key];
    if (Array.isArray(v)) v = v[0] ?? null;
    if (v instanceof Date) v = v.toISOString().slice(0, 10);
    if (v === '' || v === undefined) v = null;
    if (v !== null && NUMERIC.test(key)) v = Number(v);
    if (key === 'active' && typeof v === 'string') v = v === 'true';
    row[snake(key)] = v;
  }
  return row;
}

function fromRow(row: Rec): Rec {
  const rec: Rec = {};
  for (const [k, v] of Object.entries(row)) {
    if (k.endsWith('_id')) rec[k.slice(0, -3)] = v ? [v] : [];
    else rec[camel(k)] = typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) && k !== 'time_in' && k !== 'time_out' ? Number(v) : v;
  }
  return rec;
}

export async function request(path: string, init: RequestInit = {}) {
  const rawUrl = process.env.ZITE_SUPABASE_URL;
  const key = process.env.ZITE_API_KEY;
  if (!rawUrl || !key) {
    throw new ZiteError({ code: 'INTERNAL_ERROR', message: 'Missing ZITE_SUPABASE_URL or ZITE_API_KEY secret', userFacingMessage: 'Database is not connected. Please check the Supabase URL and API key in Secrets.' });
  }
  const base = new URL(rawUrl).origin;
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...init.headers },
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 300);
    try { msg = JSON.parse(text).message ?? msg; } catch { /* keep raw */ }
    throw new ZiteError({ code: res.status < 500 ? 'BAD_REQUEST' : 'INTERNAL_ERROR', message: `Supabase ${init.method ?? 'GET'} ${path} failed (${res.status}): ${msg}`, userFacingMessage: 'Database request failed. Please retry or contact an administrator.' });
  }
  return text ? JSON.parse(text) : null;
}

function filterQuery(filters: Rec = {}) {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(filters)) {
    const col = snake(k);
    if (v && typeof v === 'object') for (const [op, val] of Object.entries(v)) parts.push(`${col}=${op}.${encodeURIComponent(String(val))}`);
    else parts.push(`${col}=eq.${encodeURIComponent(String(v))}`);
  }
  return parts.join('&');
}

export function supabaseTable(table: string) {
  const t = tableName(table);
  return {
    async findAll({ filters, limit = 2000 }: { filters?: Rec; limit?: number } = {}) {
      const q = filterQuery(filters);
      const rows: Rec[] = await request(`/rest/v1/${t}?select=*&order=created_at.desc&limit=${limit}${q ? '&' + q : ''}`);
      return { records: rows.map(fromRow), hasMore: rows.length === limit };
    },
    async findOne({ id }: { id: string }) {
      const rows: Rec[] = await request(`/rest/v1/${t}?select=*&id=eq.${encodeURIComponent(id)}`);
      return rows[0] ? fromRow(rows[0]) : undefined;
    },
    async create({ record }: { record: Rec }) {
      const rows: Rec[] = await request(`/rest/v1/${t}`, { method: 'POST', body: JSON.stringify(toRow(table, record)) });
      return fromRow(rows[0]);
    },
    async update({ id, record }: { id: string; record: Rec }) {
      await request(`/rest/v1/${t}?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(toRow(table, record)) });
      return { id };
    },
    async delete({ id }: { id: string }) {
      await request(`/rest/v1/${t}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      return { success: true, id };
    },
    async bulkCreate({ records }: { records: Rec[] }) {
      if (!records.length) return { success: true, records: [] };
      const rows: Rec[] = await request(`/rest/v1/${t}`, { method: 'POST', body: JSON.stringify(records.map((r) => toRow(table, r))) });
      return { success: true, records: rows.map(fromRow) };
    },
  };
}

export const rpc = (fn: string, args: Rec = {}) => request(`/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });

export const db = {
  departments: supabaseTable('departments'),
  employees: supabaseTable('employees'),
  attendance: supabaseTable('attendance'),
  leaves: supabaseTable('leaves'),
  cashAdvances: supabaseTable('cashAdvances'),
  payslips: supabaseTable('payslips'),
};
