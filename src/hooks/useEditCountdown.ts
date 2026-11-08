import { useEffect, useState } from 'react';

const EDIT_WINDOW_MS = 10 * 60 * 1000;

/** Milliseconds left in the 10-minute edit/unsend window. */
export function useEditCountdown(createdAt: string): number {
  const end = new Date(createdAt).getTime() + EDIT_WINDOW_MS;
  const [left, setLeft] = useState(() => Math.max(0, end - Date.now()));

  useEffect(() => {
    const tick = () => setLeft(Math.max(0, end - Date.now()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [end]);

  return left;
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
