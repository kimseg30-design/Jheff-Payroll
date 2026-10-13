import { zite } from 'zitejs/db';
import { ZiteError } from 'zitejs/backend';

export type RequestKind = 'read' | 'write';
const LIMITS: Record<RequestKind, number> = { read: 60, write: 20 };

/** Records a failed or blocked action so admins can review it under System health. Never throws. */
export async function logFailure(summary: string, errorCode: string, userEmail?: string, details?: string) {
  try {
    await zite.failedActions.create({ record: { summary: summary.slice(0, 250), errorCode, userEmail: userEmail || undefined, details: details?.slice(0, 2000) } });
  } catch (e) {
    console.error('Could not log failed action', e);
  }
}

/** Fixed one-minute window per user and request kind, shared across all server instances. */
export async function throttle(user: { id: string; email: string }, kind: RequestKind) {
  const now = new Date();
  const minute = now.toISOString().slice(0, 16);
  const bucketKey = `${user.id}|${kind}|${minute}`;
  let count = 1;
  try {
    const existing = await zite.rateLimitBuckets.findOne({ filters: { bucketKey } });
    count = (existing?.requestCount ?? 0) + 1;
    await zite.rateLimitBuckets.bulkCreate({ records: [{ bucketKey, requestCount: count, windowStart: `${minute}:00.000Z` }], matchOn: ['bucketKey'] });
  } catch (e) {
    // Fail open: a counter outage must not lock staff out of payroll.
    console.error('Rate limit counter unavailable', e);
    return;
  }
  if (count > LIMITS[kind]) {
    if (count === LIMITS[kind] + 1) await logFailure(`Rate limit hit (${kind})`, 'RATE_LIMITED', user.email, `More than ${LIMITS[kind]} ${kind} requests in one minute`);
    throw new ZiteError({ code: 'RATE_LIMITED', message: `Rate limit exceeded for ${user.id} (${kind})`, userFacingMessage: 'Too many requests, please wait a moment.' });
  }
}
