import { useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import CrudPage from '../components/CrudPage';
import { FieldConfig } from '../components/FieldInput';
import { Rec, firstId } from '../utils/format';
import { useRecords } from '../services/records';

const fields: FieldConfig[] = [
  { key: 'departmentName', label: 'Department Name', type: 'text', required: true, full: true },
  { key: 'description', label: 'Description', type: 'textarea' },
];

export default function DepartmentsPage() {
  const { data: employees = [] } = useRecords('employees');

  const byDept = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const e of employees) {
      const d = firstId(e.department);
      if (!d) continue;
      (m[d] ??= []).push((e.fullName as string) || 'Unnamed');
    }
    for (const k in m) m[k].sort((a, b) => a.localeCompare(b));
    return m;
  }, [employees]);

  const columns = useMemo<ColumnDef<Rec>[]>(() => [
    { accessorKey: 'departmentName', header: 'Department', cell: ({ getValue }) => <span className="font-semibold">{getValue() as string}</span> },
    { id: 'count', header: 'Employees', accessorFn: (r) => byDept[r.id as string]?.length ?? 0,
      cell: ({ getValue }) => <span className="num">{getValue() as number}</span> },
    { id: 'members', header: 'Members', accessorFn: (r) => (byDept[r.id as string] ?? []).join(', '),
      cell: ({ getValue }) => (
        <span className="block max-w-sm truncate text-muted-foreground" title={getValue() as string}>{(getValue() as string) || '—'}</span>
      ) },
    { accessorKey: 'description', header: 'Description', cell: ({ getValue }) => (
      <span className="block max-w-md truncate text-muted-foreground">{(getValue() as string) || '—'}</span>
    ) },
  ], [byDept]);
  return <CrudPage table="departments" title="Departments" singular="Department"
    description="Organize employees by team or branch." columns={columns} fields={fields} />;
}
