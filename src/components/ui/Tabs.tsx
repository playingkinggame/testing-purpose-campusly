import { cn } from '@/lib/utils';

interface Tab { id: string; label: string; badge?: number }
interface Props { tabs: Tab[]; value: string; onChange: (id: string) => void; label: string }

export function Tabs({ tabs, value, onChange, label }: Props) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto rounded-2xl bg-mint/60 p-1">
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id} role="tab" type="button" aria-selected={active} onClick={() => onChange(t.id)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors',
              active ? 'bg-surface text-forest shadow-sm' : 'text-forest/70 hover:text-forest',
            )}
          >
            {t.label}
            {!!t.badge && <span className="rounded-full bg-brand px-1.5 text-xs text-white">{t.badge > 99 ? '99+' : t.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}
