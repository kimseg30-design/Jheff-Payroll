# Production Operations & Security Checklist

## Security (must be completed before production use)
- Zite app authentication is configured with signup disabled. Provision approved staff through Zite's user-management/invitation flow; do not re-enable public signup for this internal HR/payroll app.
- Every data endpoint must declare `authenticated: true` and enforce server-side role/module authorization. UI hiding alone is not authorization.
- Keep `ZITE_API_KEY` and `ZITE_SUPABASE_URL` in Zite server-side Secrets only. Never add a `VITE_*` prefix to a database secret or commit a secret.
- Before applying `supabase/security_hardening.sql`, verify that `ZITE_API_KEY` is the Supabase server-side `service_role`/secret key. The migration intentionally revokes direct `anon` and `authenticated` access. If the app uses an anon/publishable key, replace it first or database operations will fail.
- Run `supabase/security_hardening.sql` in Supabase SQL Editor as a database owner. Then verify signed-in authorized app actions work and direct unauthenticated table access is denied.
- Keep the audit trail and restrict deletion/role changes to admins.

## Rate limiting / abuse controls
- Every backend endpoint is rate limited per user: 60 reads and 20 writes/bulk actions per minute, counted in the Zite table "Rate Limit Buckets" (shared across all server instances). Rate-limit hits and permission denials are logged to "Failed Actions" and shown to admins under Users → System health. If the counter is unavailable, requests are allowed (fail-open) so staff are not locked out.
- This codebase also caps bulk attendance and payslip-release batches at 100 items and limits record payload size. These are input/resource bounds, not a substitute for request-rate limiting.
- Configure request throttling / WAF rate limits at the edge or API gateway in front of the public endpoint. Zite hosting controls are platform-managed; no app-level distributed rate-limit service is configured in this repository. Test sign-in brute-force protection and repeated endpoint calls.

## Hosting, CDN, compute, traffic
- Hosting, TLS, static asset CDN, compute allocation, load balancing, and autoscaling are managed by Zite for the published app; these cannot be provisioned by this source repository.
- Publish only after build/type checks and role-based smoke tests. The published snapshot must match the latest validated build.
- Route-level lazy loading and the existing TanStack Query cache reduce initial JavaScript and repeat reads. Do not cache payroll/employee API responses in a shared/public CDN cache.

## CI/CD and version control
- Use reviewed commits and keep the Zite version history. The included GitHub Actions workflow runs the build and production dependency audit when this repository is pushed to GitHub.
- Publishing to Zite remains a separate release step; verify the published snapshot after deployment.

## Logs, availability, recovery
- Review Zite workflow/endpoint run history after releases and investigate errors or unusual latency.
- Configure Supabase scheduled backups / point-in-time recovery according to the database plan. Store a separate periodic export in access-controlled storage and document who can restore it.
- At least quarterly, restore a backup into a non-production project and verify payroll, attendance, and sinking-fund records before declaring the recovery process tested.
- Keep a short incident runbook: pause user access, rotate exposed secrets, inspect Zite/Supabase logs, restore into a separate database first, verify totals, then resume service.
- A successful build and recent successful requests do not prove uptime, autoscaling, or disaster recovery. Run a monitored uptime check and a documented restore drill.
