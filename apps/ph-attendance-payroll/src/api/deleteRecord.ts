import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { requireTableAccess } from '../lib/roles';
import { TABLES, tableClient } from '../lib/tables';
import { syncLeaveCredits } from '../lib/leaveCredits';
import { applyDeductions, removeGeneratedContributions } from '../lib/deductions';

export default createEndpoint({
  authenticated: true,
  description: 'Deletes a record from one of the HR tables',
  inputSchema: z.object({ table: z.enum(TABLES), id: z.string() }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input, context }) => {
    await requireTableAccess(context.user, input.table, 'write');
    const client = tableClient(input.table);
    const before = await client.findOne({ id: input.id });
    await client.delete({ id: input.id });
    await syncLeaveCredits(input.table, before, undefined);
    // Generated contribution rows are linked immediately, so remove them if the draft is deleted.
    if (input.table === 'payslips' && before?.status !== 'Released') await removeGeneratedContributions(before?.deductionDetails, input.id);
    // Released payslips already reduced balances — give them back. Drafts never touched other balances.
    if (input.table === 'payslips' && before?.status === 'Released') await applyDeductions(before.deductionDetails, 1, input.id);
    return { success: true };
  },
});
