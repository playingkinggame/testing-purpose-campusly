import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Pill({ children, tone = 'mint', className }: { children: ReactNode; tone?: 'mint' | 'forest' | 'white'; className?: string }) {
  const tones = { mint: 'bg-mint text-forest', forest: 'bg-brand text-white', white: 'bg-surface/80 text-forest border border-line' };
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', tones[tone], className)}>{children}</span>;
}

export function CountBadge({ n, className }: { n: number; className?: string }) {
  if (!n) return null;
  return (
    <span aria-label={`${n} unread`} className={cn('inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-bold leading-5 text-white', className)}>
      {n > 99 ? '99+' : n}
    </span>
  );
}
