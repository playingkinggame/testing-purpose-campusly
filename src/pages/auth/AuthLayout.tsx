import type { ReactNode } from 'react';
import { Brand } from '@/components/layout/Brand';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[radial-gradient(60%_50%_at_50%_0%,var(--color-mint)_0%,var(--color-cream)_70%)] p-4">
      <div className="absolute right-3 top-3"><ThemeToggle /></div>
      <div className="w-full max-w-md space-y-6">
        <a href="/" className="flex justify-center" aria-label="Campusly home"><Brand /></a>
        <div className="glass app-auth-card space-y-5 p-6 sm:p-8">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-forest">{title}</h1>
            <p className="text-sm text-muted">{subtitle}</p>
          </div>
          {children}
        </div>
        <p className="text-center text-xs text-muted">Made only for VIT Chennai students. Not affiliated with VIT.</p>
      </div>
    </div>
  );
}
