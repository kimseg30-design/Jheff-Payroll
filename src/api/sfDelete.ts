import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { requireAdmin } from '../lib/roles';
import { sf } from '../lib/sf';

const TABLES = ['members', 'contributions', 'loans', 'payments'] as const;
const LABEL: Record<string, string> = { members: 'Member', contributions: 'Contribution', loans: 'Loan', payments: 'Payment' };

export default createEndpoint({
  authenticated: true,
  description: 'Deletes a Sinking Fund record and records it in the audit log (admins only)',
  inputSchema: z.object({ table: z.enum(TABLES), id: z.string() }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input, context }) => {
    await requireAdmin(context.user);
    const before = await sf.get(input.table, input.id);
    await sf.remove(input.table, input.id);
    const name = before?.borrowerName ?? before?.fullName ?? '';
    const amount = before?.amount != null ? ` ₱${Number(before.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '';
    const date = before?.paidOn ?? before?.contributedOn ?? '';
    await sf.audit(`${LABEL[input.table]} deleted`, input.table, input.id, `${name}${amount} ${date}`.trim(), context.user.email);
    return { success: true };
  },
});
