import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sfGetData, sfSave, sfDelete, sfDeclareBalance, SfSaveInputType, SfDeleteInputType } from 'zitejs/api';
import { toast } from 'sonner';
import { calcLoan, phToday, Row } from '../lib/loanCalc';

export function useSf() {
  const q = useQuery({ queryKey: ['sf'], queryFn: () => sfGetData({}) });
  const data = q.data;
  const calcs = useMemo(() => {
    if (!data) return [];
    const today = phToday();
    return data.loans.map((l) => calcLoan(l, data.payments, today));
  }, [data]);
  const memberName = useMemo(() => Object.fromEntries((data?.members ?? []).map((m) => [m.id, m.fullName as string])), [data]);
  return {
    isLoading: q.isLoading, error: q.error,
    members: (data?.members ?? []) as Row[], contributions: (data?.contributions ?? []) as Row[],
    loans: (data?.loans ?? []) as Row[], payments: (data?.payments ?? []) as Row[], declarations: (data?.declarations ?? []) as Row[],
    settings: (data?.settings ?? {}) as Row, calcs, memberName,
  };
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => { qc.invalidateQueries({ queryKey: ['sf'] }); qc.invalidateQueries({ queryKey: ['sfAudit'] }); };
}

export function useSfSave() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (a: SfSaveInputType) => sfSave(a), onSuccess: inv, onError: (e: Error) => toast.error(e.message || 'Could not save') });
}
export function useSfDelete() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (a: SfDeleteInputType) => sfDelete(a), onSuccess: () => { inv(); toast.success('Deleted'); }, onError: (e: Error) => toast.error(e.message || 'Could not delete') });
}
export function useSfDeclare() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: sfDeclareBalance, onSuccess: () => { inv(); toast.success('Balance declared'); }, onError: (e: Error) => toast.error(e.message) });
}
