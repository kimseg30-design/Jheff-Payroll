import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { requireTableAccess } from '../lib/roles';
import type { AttendanceRecordInput } from 'zitejs/db';
import { db } from '../lib/supabase';
import { syncLeaveCredits } from '../lib/leaveCredits';

export default createEndpoint({
  authenticated: true,
  description: 'Logs attendance for many employees at once',
  inputSchema: z.object({
    employeeIds: z.array(z.string().uuid()).min(1).max(100),
    workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    status: z.enum(['Present', 'Absent', 'Paid Leave']),
    dayType: z.enum(['Regular Day', 'Regular Holiday', 'Special Non-Working', 'Rest Day']),
    timeIn: z.string().optional(),
    timeOut: z.string().optional(),
    lateMinutes: z.number().optional(),
  }),
  outputSchema: z.object({ created: z.number() }),
  execute: async ({ input, context }) => {
    await requireTableAccess(context.user, 'attendance', 'write');
    const records = input.employeeIds.map((id) => ({
      employee: [id],
      workDate: input.workDate,
      status: input.status,
      dayType: input.dayType,
      timeIn: input.status === 'Present' ? input.timeIn ?? null : null,
      timeOut: input.status === 'Present' ? input.timeOut ?? null : null,
      lateMinutes: input.status === 'Present' ? input.lateMinutes ?? 0 : 0,
      overtimeHours: 0,
      nightDiffHours: 0,
    })) as Partial<AttendanceRecordInput>[];
    for (let i = 0; i < records.length; i += 100) {
      await db.attendance.bulkCreate({ records: records.slice(i, i + 100) as AttendanceRecordInput[] });
    }
    if (input.status === 'Paid Leave') {
      for (const r of records) await syncLeaveCredits('attendance', undefined, r);
    }
    return { created: records.length };
  },
});
