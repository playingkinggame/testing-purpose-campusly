import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/store/themeStore';
import { cn } from '@/lib/utils';

/** Small sun/moon button: switches between light and dark. */
export function ThemeToggle({ className }: { className?: string }) {
  const resolved = useTheme((s) => s.resolved);
  const toggle = useTheme((s) => s.toggle);
  const isDark = resolved === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-forest transition-colors hover:bg-mint/70', className)}
    >
      {isDark ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
    </button>
  );
}
