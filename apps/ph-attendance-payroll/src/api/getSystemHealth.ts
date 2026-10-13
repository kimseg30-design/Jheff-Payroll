import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdmin } from '../lib/roles';

const check = z.object({ status: z.enum(['ok', 'warning', 'error']), message: z.string() });

export default createEndpoint({
  authenticated: true,
  description: 'Admin-only health check: database connection, security lock-down and recent failed actions',
  inputSchema: z.object({}),
  outputSchema: z.object({
    database: check,
    security: check,
    failures: z.array(z.object({ id: z.string(), summary: z.string(), errorCode: z.string(), userEmail: z.string(), details: z.string(), occurredAt: z.string() })),
  }),
  execute: async ({ context }) => {
    await requireAdmin(context.user, 'read');
    const base = new URL(process.env.ZITE_SUPABASE_URL).origin;
    const key = process.env.ZITE_API_KEY;

    let database: z.infer<typeof check>;
    const started = Date.now();
    try {
      const res = await fetch(`${base}/rest/v1/departments?select=id&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
      database = res.ok
        ? { status: 'ok', message: `Connected to Supabase (${Date.now() - started} ms)` }
        : { status: 'error', message: `Supabase responded with error ${res.status}` };
    } catch {
      database = { status: 'error', message: 'Could not reach Supabase' };
    }

    let security: z.infer<typeof check>;
    const anonKey = (process.env as Record<string, string | undefined>).ZITE_SUPABASE_ANON_KEY;
    if (!anonKey) {
      security = { status: 'warning', message: 'Not tested — add the Supabase public (anon) key as the ZITE_SUPABASE_ANON_KEY secret to verify outsiders are blocked.' };
    } else {
      const tables = ['employees', 'payslips', 'sf_loans', 'sf_payments'];
      const exposed: string[] = [];
      for (const t of tables) {
        const res = await fetch(`${base}/rest/v1/${t}?select=id&limit=1`, { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } });
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && rows.length) exposed.push(t);
        }
      }
      security = exposed.length
        ? { status: 'error', message: `Public access is NOT blocked for: ${exposed.join(', ')}. Run security_hardening.sql in Supabase.` }
        : { status: 'ok', message: 'Public (anon) access is denied — security hardening is in place.' };
    }

    const { rows } = await zite.sql({
      query: 'SELECT "id", "summary", "errorCode", "userEmail", "details", "occurredAt" FROM "FailedActions" ORDER BY "occurredAt" DESC LIMIT 10',
    });
    const failures = rows.map((r) => ({
      id: String(r.id), summary: String(r.summary ?? ''), errorCode: String(r.errorCode ?? ''),
      userEmail: String(r.userEmail ?? ''), details: String(r.details ?? ''), occurredAt: String(r.occurredAt ?? ''),
    }));
    return { database, security, failures };
  },
});
