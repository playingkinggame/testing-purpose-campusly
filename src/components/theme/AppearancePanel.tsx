import { Monitor, Moon, Sun } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useTheme, type ThemePreference } from '@/store/themeStore';
import { cn } from '@/lib/utils';

const OPTIONS: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'Auto', icon: Monitor },
];

/** Light / Dark / Auto picker for the settings area. */
export function AppearancePanel() {
  const preference = useTheme((s) => s.preference);
  const setPreference = useTheme((s) => s.setPreference);

  return (
    <Card>
      <h2 className="text-lg font-bold text-forest">Appearance</h2>
      <p className="mb-3 text-sm text-muted">Choose how Campusly looks. Auto follows your phone or computer setting.</p>
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2 rounded-2xl bg-mint/60 p-1">
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const active = preference === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setPreference(value)}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                active ? 'bg-surface text-forest shadow-sm' : 'text-forest/70 hover:text-forest',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
