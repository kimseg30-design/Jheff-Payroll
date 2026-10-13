import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listRecords, saveRecord, deleteRecord, ListRecordsInputType } from 'zitejs/api';
import { toast } from 'sonner';
import { Rec } from '../utils/format';

export type TableName = ListRecordsInputType['table'];

export function useRecords(table: TableName) {
  return useQuery({
    queryKey: ['records', table],
    queryFn: async () => (await listRecords({ table })).records as Rec[],
  });
}

export function useSaveRecord(table: TableName) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id?: string; record: Rec }) => saveRecord({ table, ...args }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['records'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e: Error) => toast.error(e.message || 'Could not save'),
  });
}

export function useDeleteRecord(table: TableName) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRecord({ table, id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['records'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Deleted');
    },
    onError: (e: Error) => toast.error(e.message || 'Could not delete'),
  });
}

/** id → display name lookup for linked tables */
export function useNameMap(table: 'employees' | 'departments') {
  const { data = [] } = useRecords(table);
  const key = table === 'employees' ? 'fullName' : 'departmentName';
  return {
    list: data,
    map: Object.fromEntries(data.map((r) => [r.id, r[key] as string])) as Record<string, string>,
  };
}
