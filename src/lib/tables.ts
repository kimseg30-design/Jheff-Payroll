import { db } from './supabase';

export const TABLES = ['departments', 'employees', 'attendance', 'leaves', 'cashAdvances', 'payslips'] as const;
export type TableName = (typeof TABLES)[number];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function tableClient(name: TableName): any {
  return db[name];
}
