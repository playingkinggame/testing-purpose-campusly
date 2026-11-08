import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AsyncView, EmptyState } from '@/components/ui/Feedback';
import { useAsync } from '@/hooks/useAsync';
import { useUnread } from '@/store/unreadStore';
import { toast } from '@/store/uiStore';
import { friendlyError } from '@/lib/errors';
import { countUnreadNotifications, listNotifications, markAllNotificationsRead, markNotificationRead, type NotificationWithActor } from '@/lib/api/notifications';
import { NOTIFICATION_META } from '@/lib/notificationMeta';
import { cn, timeAgo } from '@/lib/utils';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const unreadCount = useUnread((s) => s.notifications);
  const notes = useAsync(() => listNotifications(50), []);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    void notes.reload();
  }, [unreadCount, notes.reload]);

  const items = notes.data ?? [];

  const markOne = async (id: string) => {
    try {
      await markNotificationRead(id);
      const now = new Date().toISOString();
      notes.setData((prev) => prev ? prev.map((n) => n.id === id ? { ...n, read_at: n.read_at ?? now } : n) : prev);
      useUnread.getState().set({ notifications: await countUnreadNotifications() });
    } catch (e) {
      toast.error(friendlyError(e));
    }
  };

  const markAll = async () => {
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      notes.setData((prev) => prev ? prev.map((n) => ({ ...n, read_at: n.read_at ?? now })) : prev);
      useUnread.getState().set({ notifications: 0 });
    } catch (e) { toast.error(friendlyError(e)); }
  };

  const open = async (notification: NotificationWithActor) => {
    if (!notification.read_at) await markOne(notification.id);
    navigate(NOTIFICATION_META[notification.kind].to);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-forest sm:text-3xl">
            <Bell className="h-7 w-7" aria-hidden="true" /> Notifications
          </h1>
          <p className="text-sm text-muted">Connection requests, invites and answers.</p>
        </div>
        {items.some((n) => !n.read_at) && (
          <Button variant="secondary" size="sm" onClick={() => void markAll()}>Mark all as read</Button>
        )}
      </div>

      <Card className="!p-2">
        <AsyncView
          loading={notes.loading}
          error={notes.error}
          onRetry={() => void notes.reload()}
          hasData={!!notes.data}
          isEmpty={items.length === 0}
          empty={<EmptyState icon={<Bell className="h-6 w-6" />} title="You're all caught up" text="New requests and replies will appear here." />}
        >
          <ul className="divide-y divide-line/70">
            {items.map((n) => {
              const meta = NOTIFICATION_META[n.kind];
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => void open(n)}
                    className={cn('flex w-full items-start gap-3 rounded-2xl p-3 text-left hover:bg-mint/40', !n.read_at && 'bg-mint/30')}
                  >
                    <Avatar path={n.actor?.avatar_path} name={n.actor?.full_name} size={40} />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="block"><strong className="text-forest">{n.actor?.full_name ?? 'Someone'}</strong> {meta.text}</span>
                      <span className="block text-xs text-muted">{timeAgo(n.created_at)}</span>
                    </span>
                    {!n.read_at && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </AsyncView>
      </Card>
    </div>
  );
}
