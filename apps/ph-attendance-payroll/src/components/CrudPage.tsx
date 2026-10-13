import { ReactNode, useMemo, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@project/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@project/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@project/components/ui/alert-dialog';
import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from './PageHeader';
import DataTable from './DataTable';
import RecordDialog from './RecordDialog';
import { FieldConfig } from './FieldInput';
import { TableName, useDeleteRecord, useRecords, useSaveRecord } from '../services/records';
import { Rec } from '../utils/format';
import { useRole } from '../services/role';

type Props = {
  table: TableName;
  title: string;
  singular: string;
  description: string;
  columns: ColumnDef<Rec>[];
  fields: FieldConfig[];
  filter?: (r: Rec) => boolean;
  toolbar?: ReactNode;
  rowActions?: (r: Rec) => ReactNode;
  headerActions?: ReactNode;
  beforeSave?: (values: Rec) => Rec;
  afterSave?: (values: Rec) => void;
  selectionActions?: (rows: Rec[], clear: () => void) => ReactNode;
};

export default function CrudPage(p: Props) {
  const { data = [], isLoading } = useRecords(p.table);
  const save = useSaveRecord(p.table);
  const del = useDeleteRecord(p.table);
  const [editing, setEditing] = useState<Rec | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Rec | null>(null);

  const { isAdmin, canEditTable } = useRole();
  const canEdit = canEditTable(p.table);
  const columns = useMemo<ColumnDef<Rec>[]>(() => !canEdit ? p.columns : [...p.columns, {
    id: 'actions', header: '', enableSorting: false,
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-1">
        {p.rowActions?.(row.original)}
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setEditing(row.original); setOpen(true); }}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(row.original)}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ),
  }], [p.columns, p.rowActions, canEdit]);

  const rows = useMemo(() => (p.filter ? data.filter(p.filter) : data), [data, p.filter]);

  return (
    <div>
      <PageHeader title={p.title} description={p.description} actions={<>
        {canEdit && p.headerActions}
        {canEdit && <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />Add {p.singular}</Button>}
      </>} />
      <DataTable columns={columns} data={rows} loading={isLoading} toolbar={p.toolbar} selectionActions={canEdit ? p.selectionActions : undefined} searchPlaceholder={`Search ${p.title.toLowerCase()}…`} />
      <RecordDialog open={open} onOpenChange={setOpen} title={`${editing ? 'Edit' : 'New'} ${p.singular}`}
        fields={p.fields} initial={editing} saving={save.isPending}
        onSubmit={(values) => save.mutate({ id: editing?.id, record: p.beforeSave ? p.beforeSave(values) : values }, {
          onSuccess: () => {
            setOpen(false);
            toast.success(`${p.singular} saved`);
            p.afterSave?.(p.beforeSave ? p.beforeSave(values) : values);
          }, 
        })} />
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {p.singular.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleting && del.mutate(deleting.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
