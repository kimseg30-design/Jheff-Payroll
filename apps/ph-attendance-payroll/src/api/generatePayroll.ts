import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { requireAdmin } from '../lib/roles';
import type { PayslipsRecordInput } from 'zitejs/db';
import { db } from '../lib/supabase';
import { sf } from '../lib/sf';
import { calcLoan } from '../lib/loanCalc';
import { computePayslip } from '../lib/payrollCalc';

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v) as string | undefined;
const r2 = (n: number) => Math.round(n * 100) / 100;
const normalize = (v: unknown) => String(v ?? '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');

function payrollDeduction(installment: number, loanFrequency: string, payrollFrequency: 'semi-monthly' | 'weekly') {
  if (payrollFrequency === 'weekly') {
    if (loanFrequency === 'Weekly') return installment;
    if (loanFrequency === 'Biweekly') return installment / 2;
    return installment / 4;
  }
  if (loanFrequency === 'Weekly') return installment * 2;
  if (loanFrequency === 'Biweekly') return installment;
  return installment / 2;
}

export default createEndpoint({
  authenticated: true,
  description: 'Generates draft payslips with cash advance deductions and linked Sinking Fund loan installments',
  inputSchema: z.object({ periodStart: z.string(), periodEnd: z.string(), periodLabel: z.string(), frequency: z.enum(['semi-monthly', 'weekly']).default('semi-monthly'),
    benefits: z.object({ sss: z.boolean(), philHealth: z.boolean(), pagIbig: z.boolean(), tax: z.boolean() }).optional() }),
  outputSchema: z.object({ created: z.number(), skipped: z.number() }),
  execute: async ({ input, context }) => {
    await requireAdmin(context.user);
    const [emps, att, advances, existing, sfLoans, sfPayments, sfMembers] = await Promise.all([
      db.employees.findAll({ filters: { active: true }, limit: 2000 }),
      db.attendance.findAll({ filters: { workDate: { gte: input.periodStart } }, limit: 2000 }),
      db.cashAdvances.findAll({ filters: { status: 'Active' }, limit: 2000 }),
      db.payslips.findAll({ filters: { periodStart: input.periodStart }, limit: 2000 }),
      sf.list('loans'),
      sf.list('payments'),
      sf.list('members'),
    ]);
    const already = new Set(existing.records.filter((p) => p.periodEnd === input.periodEnd).map((p) => first(p.employee)));
    const logs = att.records.filter((a) => String(a.workDate).slice(0, 10) <= input.periodEnd);
    const loanCalcs = sfLoans.map((l) => calcLoan(l, sfPayments));
    const records: Partial<PayslipsRecordInput>[] = [];
    let skipped = 0;
    for (const e of emps.records) {
      if (already.has(e.id)) { skipped++; continue; }
      const myLogs = logs.filter((a) => first(a.employee) === e.id).map((a) => ({
        status: a.status ?? 'Present',
        dayType: a.dayType ?? 'Regular Day',
        lateMinutes: a.lateMinutes ?? 0,
        overtimeHours: a.overtimeHours ?? 0,
        nightDiffHours: a.nightDiffHours ?? 0,
        overtimePayMode: a.overtimePayMode ?? 'Hours',
        overtimeAmount: a.overtimeAmount ?? 0,
        otherBenefit: a.otherBenefit ?? 0,
      }));
      // Draft generation previews deductions only. Ledgers update only when a payslip is released.
      let ca = 0, loan = 0, sinkingContribution = 0;
      const details: { id: string; amount: number; source?: string; label?: string; paidOn?: string; periodStart?: string; periodEnd?: string }[] = [];
      for (const a of advances.records.filter((a) => first(a.employee) === e.id)) {
        const d = Math.min(Number(a.deductionPerCutoff) || 0, Number(a.balance) || 0);
        if (d <= 0) continue;
        if (a.type === 'Cash Advance') ca += d; else loan += d;
        details.push({ id: a.id, amount: r2(d), source: 'cashAdvance', label: `${a.type ?? 'Loan'}${a.description ? ` — ${a.description}` : ''}` });
      }
      for (const c of loanCalcs) {
        const l = c.loan;
        const matched = (l.employeeId && String(Array.isArray(l.employeeId) ? l.employeeId[0] : l.employeeId) === e.id)
          || normalize(l.borrowerName) === normalize(e.fullName);
        if (!matched || c.balance <= 0.009 || c.status === 'Fully Paid') continue;
        const d = r2(Math.min(c.balance, Math.ceil(payrollDeduction(c.installment, String(l.frequency ?? 'Monthly'), input.frequency ?? 'semi-monthly') - 1e-9)));
        if (d <= 0) continue;
        loan += d;
        details.push({ id: String(l.id), amount: d, source: 'sinkingFund', paidOn: input.periodEnd, label: `Sinking Fund loan — ${l.borrowerName ?? ''}` });
      }
      // Match the Sinking Fund member to the employee by saved employee link first,
      // then by normalized full name for older member records that have no employee_id.
      // The member's baseContribution is the source of truth for their weekly amount.
      const matchingMembers = sfMembers.filter((member) => {
        if (member.status !== 'Active' || Number(member.baseContribution) <= 0) return false;
        const linkedEmployeeId = String(Array.isArray(member.employeeId) ? member.employeeId[0] ?? '' : member.employeeId ?? '');
        if (linkedEmployeeId) return linkedEmployeeId === e.id;
        return normalize(member.fullName) !== '' && normalize(member.fullName) === normalize(e.fullName);
      });
      // One employee should have only one active Sinking Fund member linked to payroll.
      // If duplicate member records match, avoid charging twice; prefer the explicitly linked record.
      const member = matchingMembers.find((m) => {
        const linkedEmployeeId = String(Array.isArray(m.employeeId) ? m.employeeId[0] ?? '' : m.employeeId ?? '');
        return linkedEmployeeId === e.id;
      }) ?? matchingMembers[0];
      if (member) {
        const weeklyAmount = r2(Number(member.baseContribution) || 0);
        const weeksCovered = (input.frequency ?? 'semi-monthly') === 'weekly' ? 1 : 2;
        const d = r2(weeklyAmount * weeksCovered);
        if (d > 0) {
          sinkingContribution += d;
          // Use the generated payroll's exact date range; contributedOn is the cutoff end date.
          details.push({
            id: String(member.id),
            amount: d,
            source: 'sinkingContribution',
            paidOn: input.periodEnd,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
          });
        }
      }
      records.push(({
        periodLabel: input.periodLabel,
        employee: [e.id],
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        status: 'Draft',
        ...computePayslip(e.dailyRate ?? 0, myLogs, ca + loan + sinkingContribution, input.frequency ?? 'semi-monthly', input.benefits),
        loanDeductions: r2(loan),
        cashAdvanceDeduction: r2(ca),
        sinkingContributionDeduction: r2(sinkingContribution),
        deductionDetails: JSON.stringify(details),
      }) as Partial<PayslipsRecordInput>);
    }
    for (let i = 0; i < records.length; i += 100) {
      await db.payslips.bulkCreate({ records: records.slice(i, i + 100) as PayslipsRecordInput[] });
    }
    return { created: records.length, skipped };
  },
});
