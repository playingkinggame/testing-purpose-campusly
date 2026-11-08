import { useEffect } from 'react';
import { PRESENCE_INTERVAL_MS } from '@/lib/constants';
import { touchPresence } from '@/lib/api/profiles';
import { listMine, markAllDelivered, totalUnread } from '@/lib/api/conversations';
import { countIncoming } from '@/lib/api/connections';
import { countUnreadNotifications } from '@/lib/api/notifications';
import { subscribeShell } from '@/lib/api/realtime';
import { useUnread } from '@/store/unreadStore';

/**
 * Runs once for the whole app shell:
 *  - touch_presence() on load and every ~60s while the tab is visible
 *  - marks incoming messages as "delivered"
 *  - keeps the unread badges fresh through Realtime (plus a refresh on reconnect / tab focus)
 */
export function useShellSync(userId: string) {
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const refreshCounts = async () => {
      try {
        const [convs, req, notif] = await Promise.all([listMine(), countIncoming(), countUnreadNotifications()]);
        if (stopped) return;
        useUnread.getState().set({ chat: totalUnread(convs), requests: req, notifications: notif });
      } catch { /* badges are a nicety; ignore errors */ }
    };
    const refreshSoon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void refreshCounts(), 400);
    };

    void touchPresence();
    void markAllDelivered().then(refreshCounts);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void touchPresence();
    }, PRESENCE_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') { void touchPresence(); refreshSoon(); }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', refreshSoon);

    const unsubscribe = subscribeShell(userId, (e) => {
      if (e === 'messages') void markAllDelivered();
      refreshSoon();
    });

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', refreshSoon);
      unsubscribe();
    };
  }, [userId]);
}
