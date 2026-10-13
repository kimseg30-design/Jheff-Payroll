import { useCallback, useMemo, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@project/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@project/components/ui/alert-dialog';
import { Eye, Play, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import PayslipDialog from '../components/PayslipDialog';
import GeneratePayrollDialog from '../components/GeneratePayrollDialog';
import { useDeleteRecord, useNameMap, useRecords } from '../services/records';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { releasePayslips } from 'zitejs/api';
import { useRole } from '../services/role';
import { Rec, firstId, peso } from '../utils/format';

const money = (key: string, header: string): ColumnDef<Rec> => ({ accessorKey: key, header, cell: ({ getValue }) => <span className="num">{peso(getValue())}</span> });

export default function PayrollPage() {
  const { data = [], isLoading } = useRecords('payslips');
  const emps = useNameMap('employees');
  const del = useDeleteRecord('payslips');
  const [period, setPeriod] = useState('all');
  const [viewing, setViewing] = useState<Rec | null>(null);
  const [deleting, setDeleting] = useState<Rec | null>(null);
  const [genOpen, setGenOpen] = useState(false);

  const periods = useMemo(() => [...new Set(data.map((p) => p.periodLabel).filter(Boolean))] as string[], [data]);
  const rows = useMemo(() => data.filter((p) => period === 'all' || p.periodLabel === period), [data, period]);
  const totals = useMemo(() => rows.reduce((a, p) => ({ gross: a.gross + (p.grossPay ?? 0), net: a.net + (p.netPay ?? 0), gov: a.gov + (p.sss ?? 0) + (p.philHealth ?? 0) + (p.pagIbig ?? 0), tax: a.tax + (p.withholdingTax ?? 0) }), { gross: 0, net: 0, gov: 0, tax: 0 }), [rows]);
  const drafts = rows.filter((p) => p.status !== 'Released');

  const qc = useQueryClient();
  const release = useMutation({
    mutationFn: (ids: string[]) => releasePayslips({ ids }),
    onSuccess: (r) => { qc.invalidateQueries(); toast.success(`Released ${r.released} payslip${r.released === 1 ? '' : 's'} · balances updated`); },
    onError: (e: Error) => toast.error(e.message),
  });
  const releaseAll = useCallback(() => release.mutate(drafts.map((p) => p.id)), [drafts, release]);

  const { isAdmin } = useRole();
  const columns = useMemo<ColumnDef<Rec>[]>(() => [
    { id: 'emp', header: 'Employee', accessorFn: (r) => emps.map[firstId(r.employee) ?? ''] ?? '—', cell: ({ getValue }) => <span className="font-semibold">{getValue() as string}</span> },
    { accessorKey: 'periodLabel', header: 'Period' },
    { accessorKey: 'daysWorked', header: 'Days', cell: ({ getValue }) => <span className="num">{Number(getValue() ?? 0)}</span> },
    money('grossPay', 'Gross'), money('otherBenefits', 'Other Benefits'), money('sss', 'SSS'), money('philHealth', 'PhilHealth'), money('pagIbig', 'Pag-IBIG'), money('withholdingTax', 'Tax'), money('cashAdvanceDeduction', 'Cash Adv.'), money('sinkingContributionDeduction', 'Contributions'), money('loanDeductions', 'Loans'),
    { accessorKey: 'netPay', header: 'Net Pay', cell: ({ getValue }) => <span className="num font-bold text-primary">{peso(getValue())}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <StatusBadge value={getValue() as string} /> },
    { id: 'actions', header: '', enableSorting: false, cell: ({ row }) => (
      <div className="flex justify-end gap-1">
        {isAdmin && row.original.status !== 'Released' && (
          <Button size="icon" variant="ghost" className="h-8 w-8" title="Release" disabled={release.isPending} onClick={() => release.mutate([row.original.id])}><Send className="h-4 w-4" /></Button>
        )}
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setViewing(row.original)}><Eye className="h-4 w-4" /></Button>
        {isAdmin && <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleting(row.original)}><Trash2 className="h-4 w-4" /></Button>}
      </div>
    ) },
  ], [emps.map, release, isAdmin]);

  const stats = [['Gross payroll', totals.gross], ['Gov. contributions', totals.gov], ['Withholding tax', totals.tax], ['Net payroll', totals.net]] as const;

  return (
    <div>
      <PageHeader title="Payroll" description="Semi-monthly payslips with SSS, PhilHealth, Pag-IBIG and BIR (TRAIN) deductions."
        actions={<>
          {isAdmin && drafts.length > 0 && <Button variant="outline" disabled={release.isPending} onClick={releaseAll}><Send className="mr-2 h-4 w-4" />Release {drafts.length} draft{drafts.length === 1 ? '' : 's'}</Button>}
          {isAdmin && <Button onClick={() => setGenOpen(true)}><Play className="mr-2 h-4 w-4" />Run payroll</Button>}
        </>} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(([l, v], i) => (
          <div key={l} className={`rounded-xl border p-4 shadow-sm ${i === 3 ? 'border-primary bg-primary text-primary-foreground' : 'bg-card'}`}>
            <div className={`text-xs font-semibold uppercase tracking-wide ${i === 3 ? 'opacity-80' : 'text-muted-foreground'}`}>{l}</div>
            <div className="num mt-1 truncate text-xl font-bold">{peso(v)}</div>
          </div>
        ))}
      </div>
      <DataTable columns={columns} data={rows} loading={isLoading} searchPlaceholder="Search payslips…" toolbar={
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All periods</SelectItem>{periods.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
        </Select>
      } />
      <PayslipDialog slip={viewing} employee={emps.list.find((e) => e.id === firstId(viewing?.employee))} onClose={() => setViewing(null)} />
      <GeneratePayrollDialog open={genOpen} onOpenChange={setGenOpen} />
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this payslip?</AlertDialogTitle>
            <AlertDialogDescription>{deleting?.status === 'Released'
              ? 'Cash advance and loan balances deducted by this payslip will be restored.'
              : 'This is a draft — cash advance and loan balances were not touched.'}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleting && del.mutate(deleting.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
