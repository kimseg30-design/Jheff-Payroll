import { db } from './supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = Record<string, any> | undefined;
const first = (v: unknown) => (Array.isArray(v) ? v[0] : v) as string | undefined;

/** Leave credits a leave or attendance record consumes. */
export function creditsUsed(table: string, r: Rec): number {
  if (!r) return 0;
  if (table === 'leaves') return r.status === 'Approved' && r.leaveType !== 'Leave Without Pay' ? Number(r.days ?? 0) : 0;
  if (table === 'attendance') return r.status === 'Paid Leave' ? 1 : 0;
  return 0;
}

/** Adjusts employees' leave credits for a change from `before` to `after`. */
export async function syncLeaveCredits(table: string, before: Rec, after: Rec) {
  if (table !== 'leaves' && table !== 'attendance') return;
  const deltas = new Map<string, number>();
  const add = (id: string | undefined, n: number) => { if (id && n) deltas.set(id, (deltas.get(id) ?? 0) + n); };
  add(first(before?.employee), creditsUsed(table, before)); // restore old usage
  add(first(after?.employee), -creditsUsed(table, after)); // deduct new usage
  await Promise.all([...deltas].filter(([, d]) => d !== 0).map(async ([id, d]) => {
    const emp = await db.employees.findOne({ id });
    if (!emp) return;
    await db.employees.update({ id, record: { leaveCredits: Math.max(0, (emp.leaveCredits ?? 0) + d) } });
  }));
}
