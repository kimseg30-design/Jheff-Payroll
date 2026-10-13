import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { setPayslipDeduction } from 'zitejs/api';
import { Switch } from '@project/components/ui/switch';
import { Rec, peso } from '../utils/format';

type Detail = { id: string; amount: number; source?: string; skipped?: boolean; label?: string };

// Lets admins skip a loan / cash advance deduction on a draft payslip before it is released.
export default function PayslipLoanToggles({ slip, onChange }: { slip: Rec; onChange: (s: Rec) => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  let details: Detail[] = [];
  try { details = JSON.parse(String(slip.deductionDetails || '[]')); } catch { /* empty */ }
  const loans = details.filter((d) => d.source !== 'sinkingContribution');
  if (!loans.length) return null;

  const toggle = async (d: Detail, include: boolean) => {
    const key = `${d.source}-${d.id}`;
    setBusy(key);
    try {
      const r = await setPayslipDeduction({ payslipId: String(slip.id), detailId: d.id, source: d.source, include });
      onChange(r.slip as Rec);
      qc.invalidateQueries({ queryKey: ['records'] });
      toast.success(include ? 'Deduction included' : 'Deduction skipped for this payslip');
    } catch (e) {
      toast.error((e as Error).message || 'Could not update deduction');
    } finally { setBusy(null); }
  };

  return (
    <div className="rounded-lg border p-3 print:hidden">
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Loan deductions this cutoff</div>
      <div className="space-y-2">
        {loans.map((d) => {
          const key = `${d.source}-${d.id}`;
          return (
            <label key={key} className="flex items-center justify-between gap-3 text-sm">
              <span className={d.skipped ? 'text-muted-foreground line-through' : ''}>
                {d.label ?? (d.source === 'sinkingFund' ? 'Sinking Fund loan' : 'Loan / cash advance')}
              </span>
              <span className="flex items-center gap-3">
                <span className="num">{peso(d.amount)}</span>
                <Switch checked={!d.skipped} disabled={busy === key} onCheckedChange={(v) => toggle(d, v)} />
              </span>
            </label>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Turn off to skip a deduction for this payslip. The loan balance stays unchanged for skipped items.</p>
    </div>
  );
}
