import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Switch } from '@project/components/ui/switch';
import { DatePicker } from '@project/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { parseISO } from 'date-fns';
import { toISODate } from '../utils/format';

export type FieldConfig = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'time' | 'select' | 'link' | 'textarea' | 'checkbox';
  options?: string[];
  linkOptions?: { id: string; name: string }[];
  required?: boolean;
  full?: boolean;
  defaultValue?: unknown;
};

type Props = { field: FieldConfig; value: unknown; error?: string; onChange: (v: unknown) => void };

export default function FieldInput({ field: f, value, error, onChange }: Props) {
  const v = (value ?? '') as string;
  const wide = f.full || f.type === 'textarea';
  let control;
  if (f.type === 'textarea') control = <Textarea value={v} onChange={(e) => onChange(e.target.value)} rows={3} />;
  else if (f.type === 'checkbox') control = <div className="flex h-9 items-center"><Switch checked={!!value} onCheckedChange={onChange} /></div>;
  else if (f.type === 'date') control = (
    <DatePicker value={v ? parseISO(String(v).slice(0, 10)) : undefined} onChange={(d) => onChange(d ? toISODate(d) : '')} />
  );
  else if (f.type === 'select' || f.type === 'link') {
    const opts = f.type === 'select' ? (f.options ?? []).map((o) => ({ id: o, name: o })) : (f.linkOptions ?? []);
    control = (
      <Select value={v || undefined} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder={`Select ${f.label.toLowerCase()}`} /></SelectTrigger>
        <SelectContent>{opts.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
      </Select>
    );
  } else control = (
    <Input type={f.type === 'number' ? 'number' : f.type === 'time' ? 'time' : 'text'} step="any" value={v} onChange={(e) => onChange(e.target.value)} />
  );

  return (
    <div className={wide ? 'space-y-1.5 sm:col-span-2' : 'space-y-1.5'}>
      <Label className="text-xs font-semibold">{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
      {control}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
