import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { getRole, getPermissions } from '../lib/roles';
import { throttle } from '../lib/guard';

export default createEndpoint({
  authenticated: true,
  description: 'Returns the signed-in user role and module permissions',
  inputSchema: z.object({}),
  outputSchema: z.object({
    role: z.enum(['Admin', 'Viewer', 'Editor', 'None']),
    permissions: z.array(z.enum(['attendance', 'cashAdvances'])),
  }),
  execute: async ({ context }) => {
    await throttle(context.user, 'read');
    return { role: await getRole(context.user), permissions: await getPermissions(context.user) };
  },
});
