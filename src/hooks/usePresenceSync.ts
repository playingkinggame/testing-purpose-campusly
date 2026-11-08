import { useEffect } from 'react';
import { joinPresence } from '@/lib/api/realtime';
import { usePresence } from '@/store/presenceStore';

/** One presence channel for the shell. hide_online users never track themselves. */
export function usePresenceSync(userId: string, hideOnline: boolean) {
  useEffect(() => {
    if (!userId) return;
    return joinPresence(
      userId,
      hideOnline,
      (ids) => usePresence.getState().setOnline(ids),
      () => usePresence.getState().reset(),
    );
  }, [userId, hideOnline]);
}
