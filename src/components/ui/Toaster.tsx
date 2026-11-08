import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { useUi } from '@/store/uiStore';
import { cn } from '@/lib/utils';

export function Toaster() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismiss);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6">
      {toasts.map((t) => {
        const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? XCircle : Info;
        return (
          <button
            key={t.id} type="button" onClick={() => dismiss(t.id)}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={cn(
              'app-toast pointer-events-auto flex max-w-md items-center gap-2 rounded-2xl px-4 py-3 text-left text-sm font-medium shadow-lg',
              t.kind === 'error' ? 'bg-danger text-white' : 'bg-brand text-white',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t.text}
          </button>
        );
      })}
    </div>
  );
}
