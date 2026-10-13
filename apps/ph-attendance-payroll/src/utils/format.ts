import { format, parseISO } from 'date-fns';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Rec = Record<string, any>;

const pesoFmt = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
export const peso = (n: unknown) => pesoFmt.format(Number(n) || 0);

export const firstId = (v: unknown): string | undefined => (Array.isArray(v) ? v[0] : (v as string) || undefined);

export function fmtDate(v: unknown) {
  if (!v) return '—';
  try {
    return format(parseISO(String(v).slice(0, 10)), 'MMM d, yyyy');
  } catch {
    return String(v);
  }
}

export const toISODate = (d: Date) => format(d, 'yyyy-MM-dd');
