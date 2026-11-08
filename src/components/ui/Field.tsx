import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface FieldWrap { label: string; hint?: ReactNode; error?: string | null; required?: boolean }

const base =
  'w-full rounded-2xl border border-line bg-surface/80 px-4 text-[15px] text-ink placeholder:text-muted/70 ' +
  'focus:border-forest disabled:opacity-60';

function Wrap({ id, label, hint, error, required, children }: FieldWrap & { id: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-forest">
        {label}{required && <span className="text-danger-ink" aria-hidden="true"> *</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-sm text-danger-ink">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldWrap>(function Input(
  { label, hint, error, required, className, ...rest }, ref,
) {
  const id = useId();
  return (
    <Wrap id={id} label={label} hint={hint} error={error} required={required}>
      <input
        ref={ref} id={id} required={required}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        className={cn(base, 'h-12', error && 'border-danger-ink', className)}
        {...rest}
      />
    </Wrap>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldWrap>(function Textarea(
  { label, hint, error, required, className, ...rest }, ref,
) {
  const id = useId();
  return (
    <Wrap id={id} label={label} hint={hint} error={error} required={required}>
      <textarea
        ref={ref} id={id} required={required}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        className={cn(base, 'min-h-24 py-3', error && 'border-danger-ink', className)}
        {...rest}
      />
    </Wrap>
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & FieldWrap>(function Select(
  { label, hint, error, required, className, children, ...rest }, ref,
) {
  const id = useId();
  return (
    <Wrap id={id} label={label} hint={hint} error={error} required={required}>
      <select
        ref={ref} id={id} required={required}
        aria-invalid={!!error || undefined}
        className={cn(base, 'h-12', error && 'border-danger-ink', className)}
        {...rest}
      >
        {children}
      </select>
    </Wrap>
  );
});
