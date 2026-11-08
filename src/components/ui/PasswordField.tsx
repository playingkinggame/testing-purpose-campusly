import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  hint?: ReactNode;
  error?: string | null;
}

/** Password input with a show / hide button. Looks like the other fields in ui/Field.tsx. */
export const PasswordField = forwardRef<HTMLInputElement, Props>(function PasswordField(
  { label, hint, error, required, className, ...rest }, ref,
) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-forest">
        {label}{required && <span className="text-danger-ink" aria-hidden="true"> *</span>}
      </label>
      <div className="relative">
        <input
          ref={ref} id={id} required={required} type={show ? 'text' : 'password'}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          className={cn(
            'h-12 w-full rounded-2xl border border-line bg-surface/80 pl-4 pr-12 text-[15px] text-ink ' +
            'placeholder:text-muted/70 focus:border-forest disabled:opacity-60',
            error && 'border-danger-ink', className,
          )}
          {...rest}
        />
        <button
          type="button" onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}
          className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-muted hover:bg-mint/60 hover:text-forest"
        >
          {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-sm text-danger-ink">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
});
