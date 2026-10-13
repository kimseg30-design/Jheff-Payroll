import { differenceInCalendarMonths, parseISO } from 'date-fns';
import { calcLoan, firstDueFor, Row } from './loanCalc';

export type InterestReconciliationSegment = {
  declarationId: string;
  declaredAt: string;
  previousPrincipal: number;
  declaredPrincipal: number;
  paymentsRecorded: number;
  historicalInterestPaid: number;
};

export function reconcileHistoricalInterest(loan: Row, allPayments: Row[], declarations: Row[]): InterestReconciliationSegment[] {
  const history = declarations
    .filter((d) => String(d.loanId) === String(loan.id) && d.declaredAt)
    .sort((a, b) => String(a.declaredAt).localeCompare(String(b.declaredAt)) || String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')));

  let segmentStart = String(loan.startDate);
  let segmentPrincipal = Number(loan.principal) || 0;
  let segmentIndex = 0;
  const result: InterestReconciliationSegment[] = [];

  for (const declaration of history) {
    const boundary = String(declaration.declaredAt).slice(0, 10);
    const payments = allPayments.filter((p) =>
      String(p.loanId) === String(loan.id) &&
      (segmentIndex === 0 ? String(p.paidOn).slice(0, 10) >= segmentStart : String(p.paidOn).slice(0, 10) > segmentStart) &&
      String(p.paidOn).slice(0, 10) <= boundary
    );
    const elapsed = Math.max(0, differenceInCalendarMonths(parseISO(boundary), parseISO(String(loan.startDate))));
    const segmentLoan = {
      ...loan,
      principal: segmentPrincipal,
      startDate: segmentStart,
      firstDueDate: firstDueFor(segmentStart, String(loan.frequency ?? 'Monthly')),
      termMonths: Math.max(1, (Number(loan.termMonths) || 1) - elapsed),
      declaredPrincipal: null,
      declaredAt: null,
    };
    const calculated = calcLoan(segmentLoan, payments, boundary);
    result.push({
      declarationId: String(declaration.id),
      declaredAt: boundary,
      previousPrincipal: Number(declaration.previousPrincipal ?? segmentPrincipal) || 0,
      declaredPrincipal: Number(declaration.declaredPrincipal) || 0,
      paymentsRecorded: payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
      historicalInterestPaid: calculated.interestPaid,
    });
    segmentStart = boundary;
    segmentPrincipal = Number(declaration.declaredPrincipal) || 0;
    segmentIndex++;
  }

  return result;
}

export function historicalInterestTotal(loan: Row, allPayments: Row[], declarations: Row[]): number {
  return Math.round(reconcileHistoricalInterest(loan, allPayments, declarations)
    .reduce((sum, segment) => sum + segment.historicalInterestPaid, 0) * 100) / 100;
}
