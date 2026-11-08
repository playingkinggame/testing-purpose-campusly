import { useId, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { uniqueTags } from '@/lib/utils';

interface Props {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  max: number;
  suggestions?: string[];
  placeholder?: string;
  hint?: string;
}

export function TagInput({ label, value, onChange, max, suggestions = [], placeholder, hint }: Props) {
  const id = useId();
  const [text, setText] = useState('');

  const add = (raw: string) => {
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    onChange(uniqueTags([...value, ...parts], max));
    setText('');
  };
  const remove = (t: string) => onChange(value.filter((v) => v !== t));
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(text); }
    else if (e.key === 'Backspace' && !text && value.length) remove(value[value.length - 1]);
  };

  const left = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase())).slice(0, 6);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-forest">
        {label} <span className="font-normal text-muted">({value.length}/{max})</span>
      </label>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface/80 p-2 focus-within:border-forest">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-mint px-3 py-1 text-sm font-medium text-forest">
            {t}
            <button type="button" onClick={() => remove(t)} aria-label={`Remove ${t}`} className="rounded-full p-0.5 hover:bg-forest/10">
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={id} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} onBlur={() => add(text)}
          disabled={value.length >= max}
          placeholder={value.length >= max ? 'Limit reached' : placeholder ?? 'Type and press Enter'}
          className="min-w-32 flex-1 bg-transparent px-2 py-1.5 text-[15px] outline-none focus-visible:outline-none"
        />
      </div>
      {left.length > 0 && value.length < max && (
        <div className="flex flex-wrap gap-1.5" aria-label={`${label} suggestions`}>
          {left.map((s) => (
            <button key={s} type="button" onClick={() => add(s)}
              className="rounded-full border border-line bg-surface/70 px-2.5 py-1 text-xs text-forest hover:bg-mint">
              + {s}
            </button>
          ))}
        </div>
      )}
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  );
}
