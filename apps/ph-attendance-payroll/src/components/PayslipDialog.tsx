import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Printer } from 'lucide-react';
import { Rec, fmtDate, peso } from '../utils/format';
import LoanToggles from './PayslipLoanToggles';

function Line({ label, value, neg, bold }: { label: string; value: unknown; neg?: boolean; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 text-sm ${bold ? 'border-t pt-2 font-bold' : ''}`}>
      <span className={bold ? '' : 'text-muted-foreground'}>{label}</span>
      <span className="num">{neg ? '−' : ''}{peso(value)}</span>
    </div>
  );
}

export default function PayslipDialog({ slip, employee, onClose }: { slip: Rec | null; employee?: Rec; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const print = () => {
    if (!ref.current) return;
    const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map((n) => n.outerHTML).join('');
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(frame);
    const doc = frame.contentDocument!;
    doc.open();
    doc.write(`<!doctype html><html><head><title>Payslip</title>${styles}<style>@page{size:A4;margin:16mm}body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body class="font-sans text-foreground"><div style="max-width:720px;margin:0 auto">${ref.current.innerHTML}</div></body></html>`);
    doc.close();
    setTimeout(() => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => frame.remove(), 1000);
    }, 500);
  };
  const [local, setLocal] = useState<Rec | null>(slip);
  useEffect(() => setLocal(slip), [slip]);
  const s = local ?? {};
  const deductions = (s.sss ?? 0) + (s.philHealth ?? 0) + (s.pagIbig ?? 0) + (s.withholdingTax ?? 0) + (s.loanDeductions ?? 0) + (s.cashAdvanceDeduction ?? 0) + (s.sinkingContributionDeduction ?? 0) + (s.lateDeduction ?? 0);
  return (
    <Dialog open={!!slip} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Payslip</DialogTitle></DialogHeader>
        <div ref={ref} className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-primary p-4 text-primary-foreground">
            <div>
              <div className="text-lg font-bold">{employee?.fullName ?? '—'}</div>
              <div className="text-sm opacity-80">{employee?.position} · {employee?.employeeNo}</div>
            </div>
            <div className="text-right text-sm">
              <div className="font-semibold">{s.periodLabel}</div>
              <div className="opacity-80">{fmtDate(s.periodStart)} – {fmtDate(s.periodEnd)}</div>
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Earnings</h4>
              <div className="flex justify-between py-1.5 text-sm"><span className="text-muted-foreground">Days worked</span><span className="num">{s.daysWorked ?? 0}</span></div>
              <Line label="Basic pay" value={s.basicPay} />
              <Line label="Overtime" value={s.overtimePay} />
              <Line label="Other benefits" value={s.otherBenefits} />
              <Line label="Night differential" value={s.nightDiffPay} />
              <Line label="Holiday / rest day" value={s.holidayPay} />
              <Line label="Late / undertime" value={s.lateDeduction} neg />
              <Line label="Gross pay" value={s.grossPay} bold />
            </div>
            <div>
              <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Deductions</h4>
              <Line label="SSS" value={s.sss} />
              <Line label="PhilHealth" value={s.philHealth} />
              <Line label="Pag-IBIG" value={s.pagIbig} />
              <Line label="Withholding tax" value={s.withholdingTax} />
              <Line label="Cash advances" value={s.cashAdvanceDeduction} />
              <Line label="Sinking Fund contribution (weekly)" value={s.sinkingContributionDeduction} />
              <Line label="Loans (Sinking Fund / other loans)" value={s.loanDeductions} />
              <Line label="Total deductions" value={deductions - (s.lateDeduction ?? 0)} bold />
            </div>
          </div>
          {s.status === 'Draft' && s.id && <LoanToggles slip={s} onChange={setLocal} />}
          <div className="flex items-center justify-between rounded-lg border-2 border-primary/20 bg-accent/40 px-4 py-3">
            <span className="font-semibold">Net Pay</span>
            <span className="num text-2xl font-bold text-primary">{peso(s.netPay)}</span>
          </div>
          <p className="text-xs text-muted-foreground">TIN {employee?.tin || '—'} · SSS {employee?.sssNo || '—'} · PhilHealth {employee?.philHealthNo || '—'} · Pag-IBIG {employee?.pagIbigNo || '—'}</p>
        </div>
        <div className="flex justify-end"><Button variant="outline" onClick={print}><Printer className="mr-2 h-4 w-4" />Print</Button></div>
      </DialogContent>
    </Dialog>
  );
}
