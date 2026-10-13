import { ziteAuth } from 'zitejs/auth/server';
import { zite } from 'zitejs/db';

export default ziteAuth({
  hooks: {
    async beforeSignUp(input) {
      // Sign-up is invite-only: admit emails an admin added on the Users & Roles page.
      const invite = await zite.appInvites.findOne({ filters: { email: input.email.trim().toLowerCase() } });
      return invite ? { allow: true } : undefined;
    },
  },
});
