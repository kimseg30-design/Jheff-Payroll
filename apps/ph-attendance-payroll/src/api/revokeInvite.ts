import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdmin } from '../lib/roles';

export default createEndpoint({
  authenticated: true,
  description: 'Cancels a pending user invite (admins only)',
  inputSchema: z.object({ id: z.string() }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input, context }) => {
    await requireAdmin(context.user);
    await zite.appInvites.delete({ id: input.id });
    return { success: true };
  },
});
