import { z } from 'zod';
import { addDays, format, parseISO } from 'date-fns';
import { createEndpoint } from 'zitejs/backend';
import { requireMember } from '../lib/roles';
import { request, rpc } from '../lib/supabase';
import { withLog } from '../lib/guard';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const phToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
const PRESENT = ['Present', 'Halfday', 'Paid Leave'];

export default createEndpoint({
  authenticated: true,
  description: 'Returns headline HR and payroll stats for the dashboard as of a chosen date',
  inputSchema: z.object({ date: z.string().optional() }),
  outputSchema: z.object({
    date: z.string(),
    activeEmployees: z.number(),
    presentToday: z.number(),
    absentToday: z.number(),
    pendingLeaves: z.number(),
    outstandingLoans: z.number(),
    lastPayrollTotal: z.number(),
    lastPayrollLabel: z.string().nullable(),
    attendanceByDay: z.array(z.object({ date: z.string(), present: z.number(), absent: z.number() })),
    byDepartment: z.array(z.object({ name: z.string(), count: z.number() })),
  }),
  execute: withLog('getDashboard', async ({ input, context }) => {
    await requireMember(context.user);
    const today = phToday();
    const date = input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date) && input.date <= today ? input.date : today;
    const start = format(addDays(parseISO(date), -13), 'yyyy-MM-dd');

    const [d, att, slips]: Any[] = await Promise.all([
      rpc('get_dashboard'),
      request(`/rest/v1/attendance?select=work_date,status&work_date=gte.${start}&work_date=lte.${date}&limit=20000`),
      request(`/rest/v1/payslips?select=period_label,period_end,net_pay&period_end=lte.${date}&order=period_end.desc&limit=5000`),
    ]);

    const days: Record<string, { present: number; absent: number }> = {};
    for (let i = 0; i < 14; i++) days[format(addDays(parseISO(start), i), 'yyyy-MM-dd')] = { present: 0, absent: 0 };
    for (const r of att as Any[]) {
      const k = String(r.work_date).slice(0, 10);
      if (!days[k]) continue;
      if (PRESENT.includes(r.status)) days[k].present++;
      else if (r.status === 'Absent') days[k].absent++;
    }

    const last = (slips as Any[])[0];
    const lastRows = last ? (slips as Any[]).filter((s) => s.period_label === last.period_label && s.period_end === last.period_end) : [];

    return {
      date,
      activeEmployees: Number(d.activeEmployees ?? 0),
      presentToday: days[date].present,
      absentToday: days[date].absent,
      pendingLeaves: Number(d.pendingLeaves ?? 0),
      outstandingLoans: Number(d.outstandingLoans ?? 0),
      lastPayrollTotal: lastRows.reduce((a, s) => a + Number(s.net_pay || 0), 0),
      lastPayrollLabel: last?.period_label ? String(last.period_label) : null,
      attendanceByDay: Object.entries(days).map(([k, v]) => ({ date: k, ...v })),
      byDepartment: (d.byDepartment ?? []).map((r: Any) => ({ name: String(r.name), count: Number(r.count) })),
    };
  }),
});
