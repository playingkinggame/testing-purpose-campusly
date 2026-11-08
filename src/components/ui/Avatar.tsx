import { useState } from 'react';
import { avatarUrl } from '@/lib/api/storage';
import { cn, initials } from '@/lib/utils';

interface Props {
  path?: string | null;
  name?: string | null;
  src?: string | null; // direct URL (for a local preview)
  size?: number;
  className?: string;
}

export function Avatar({ path, name, src, size = 40, className }: Props) {
  const [broken, setBroken] = useState(false);
  const url = src ?? avatarUrl(path);
  const style = { width: size, height: size, fontSize: Math.max(11, size * 0.38) };
  if (url && !broken) {
    return (
      <img
        src={url} alt={name ? `${name}'s photo` : 'Profile photo'} style={style} loading="lazy"
        onError={() => setBroken(true)}
        className={cn('shrink-0 rounded-full bg-mint object-cover', className)}
      />
    );
  }
  return (
    <span
      role="img" aria-label={name ? `${name} (no photo)` : 'No photo'} style={style}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-mint font-semibold text-forest', className)}
    >
      {initials(name)}
    </span>
  );
}
