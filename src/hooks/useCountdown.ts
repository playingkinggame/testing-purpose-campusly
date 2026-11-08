import { useEffect, useState } from 'react';
import { EDIT_WINDOW_MS } from '@/lib/constants';

/** Seconds left in the 10-minute edit/unsend window (0 when over). Ticks every second only while time remains. */
export function useEditCountdown(createdAtIso: string): number {
  const calc = () => Math.max(0, Math.ceil((new Date(createdAtIso).getTime() + EDIT_WINDOW_MS - Date.now()) / 1000));
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    setLeft(calc());
    if (calc() <= 0) return;
    const t = setInterval(() => {
      const v = calc();
      setLeft(v);
      if (v <= 0) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createdAtIso]);
  return left;
}

export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
