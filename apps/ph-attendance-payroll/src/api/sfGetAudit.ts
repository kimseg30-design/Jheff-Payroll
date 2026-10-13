import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { requireMember } from '../lib/roles';
import { sf } from '../lib/sf';

export default createEndpoint({
  authenticated: true,
  description: 'Lists the Sinking Fund audit trail, newest first',
  inputSchema: z.object({}),
  outputSchema: z.object({ entries: z.array(z.record(z.any())) }),
  execute: async ({ context }) => {
    await requireMember(context.user);
    return { entries: await sf.list('auditLog', 2000) };
  },
});
