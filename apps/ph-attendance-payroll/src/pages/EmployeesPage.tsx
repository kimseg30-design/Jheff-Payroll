import { useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import CrudPage from '../components/CrudPage';
import StatusBadge from '../components/StatusBadge';
import { FieldConfig } from '../components/FieldInput';
import { useNameMap } from '../services/records';
import { Rec, fmtDate, firstId, peso } from '../utils/format';

export default function EmployeesPage() {
  const depts = useNameMap('departments');
  const columns = useMemo<ColumnDef<Rec>[]>(() => [
    { accessorKey: 'employeeNo', header: 'No.', cell: ({ getValue }) => <span className="num text-xs text-muted-foreground">{getValue() as string || '—'}</span> },
    { accessorKey: 'fullName', header: 'Name', cell: ({ row }) => (
      <div><div className="font-semibold">{row.original.fullName}</div><div className="text-xs text-muted-foreground">{row.original.position || '—'}</div></div>
    ) },
    { id: 'dept', header: 'Department', accessorFn: (r) => depts.map[firstId(r.department) ?? ''] ?? '—' },
    { accessorKey: 'employmentStatus', header: 'Status', cell: ({ getValue }) => <StatusBadge value={getValue() as string} /> },
    { accessorKey: 'dailyRate', header: 'Daily Rate', cell: ({ getValue }) => <span className="num">{peso(getValue())}</span> },
    { accessorKey: 'leaveCredits', header: 'Leave Credits', cell: ({ getValue }) => <span className="num">{Number(getValue() ?? 0).toFixed(1)}</span> },
    { accessorKey: 'dateHired', header: 'Hired', cell: ({ getValue }) => fmtDate(getValue()) },
    { accessorKey: 'active', header: 'Active', cell: ({ getValue }) => <StatusBadge value={getValue() ? 'Employed' : 'Inactive'} /> },
  ], [depts.map]);

  const fields = useMemo<FieldConfig[]>(() => [
    { key: 'fullName', label: 'Full Name', type: 'text', required: true },
    { key: 'employeeNo', label: 'Employee No.', type: 'text', required: true },
    { key: 'position', label: 'Position', type: 'text' },
    { key: 'department', label: 'Department', type: 'link', linkOptions: depts.list.map((d) => ({ id: d.id, name: d.departmentName })) },
    { key: 'dailyRate', label: 'Daily Rate (₱)', type: 'number', required: true },
    { key: 'employmentStatus', label: 'Employment Status', type: 'select', options: ['Regular', 'Probationary', 'Contractual'], required: true },
    { key: 'dateHired', label: 'Date Hired', type: 'date' },
    { key: 'leaveCredits', label: 'Leave Credits', type: 'number', defaultValue: 5 },
    { key: 'tin', label: 'TIN', type: 'text' },
    { key: 'sssNo', label: 'SSS No.', type: 'text' },
    { key: 'philHealthNo', label: 'PhilHealth No.', type: 'text' },
    { key: 'pagIbigNo', label: 'Pag-IBIG No.', type: 'text' },
    { key: 'active', label: 'Active', type: 'checkbox', defaultValue: true },
  ], [depts.list]);

  return <CrudPage table="employees" title="Employees" singular="Employee"
    description="Personnel records, daily rates and government IDs." columns={columns} fields={fields} />;
}
