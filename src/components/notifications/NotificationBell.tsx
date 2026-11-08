import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { CountBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAsync } from '@/hooks/useAsync';
import { useUnread } from '@/store/unreadStore';
import { toast } from '@/store/uiStore';
import { friendlyError } from '@/lib/errors';
import { countUnreadNotifications, listNotifications, markAllNotificationsRead, markNotificationRead, type NotificationWithActor } from '@/lib/api/notifications';
import { NOTIFICATION_META } from '@/lib/notificationMeta';
import { cn, timeAgo } from '@/lib/utils';

export function NotificationBell() {
  const navigate = useNavigate();
  const unread = useUnread((s) => s.notifications);
  const [open, setOpen] = useState(false);
  const notes = useAsync(() => listNotifications(8), []);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) void notes.reload();
  }, [open, notes.reload, unread]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items = notes.data ?? [];
  const hasUnread = items.some((n) => !n.read_at);

  const markOne = async (id: string) => {
    try {
      await markNotificationRead(id);
      const now = new Date().toISOString();
      notes.setData((prev) => prev ? prev.map((n) => n.id === id ? { ...n, read_at: n.read_at ?? now } : n) : prev);
      useUnread.getState().set({ notifications: await countUnreadNotifications() });
    } catch (e) { toast.error(friendlyError(e)); }
  };

  const markAll = async () => {
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      notes.setData((prev) => prev ? prev.map((n) => ({ ...n, read_at: n.read_at ?? now })) : prev);
      useUnread.getState().set({ notifications: 0 });
    } catch (e) { toast.error(friendlyError(e)); }
  };

  const openNotification = async (n: NotificationWithActor) => {
    setOpen(false);
    if (!n.read_at) await markOne(n.id);
    navigate(NOTIFICATION_META[n.kind].to);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-line bg-surface/70 text-forest hover:bg-mint/60"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unread > 0 && <CountBadge n={unread} className="absolute -right-1.5 -top-1.5 !min-w-4 !px-1 !text-[10px] !leading-4" />}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications" className="app-pop absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
            <p className="text-sm font-semibold text-forest">Notifications</p>
            {hasUnread ? (
              <Button variant="ghost" size="sm" onClick={() => void markAll()}>
                <CheckCheck className="h-4 w-4" aria-hidden="true" /> Mark all
              </Button>
            ) : null}
          </div>

          <div className="max-h-80 overflow-y-auto p-1.5">
            {notes.loading && !notes.data ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…
              </div>
            ) : notes.error && !notes.data ? (
              <div className="space-y-2 px-2 py-4 text-center">
                <p className="text-sm text-danger-ink">{notes.error}</p>
                <Button variant="secondary" size="sm" onClick={() => void notes.reload()}>Try again</Button>
              </div>
            ) : items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted">You're all caught up. New activity will show up here.</p>
            ) : (
              <ul>
                {items.map((n) => {
                  const meta = NOTIFICATION_META[n.kind];
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => void openNotification(n)}
                        className={cn('flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left hover:bg-mint/40', !n.read_at && 'bg-mint/30')}
                      >
                        <Avatar path={n.actor?.avatar_path} name={n.actor?.full_name} size={34} />
                        <span className="min-w-0 flex-1 text-sm">
                          <span className="block leading-snug"><strong className="text-forest">{n.actor?.full_name ?? 'Someone'}</strong> {meta.text}</span>
                          <span className="block text-xs text-muted">{timeAgo(n.created_at)}</span>
                        </span>
                        {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-line p-1.5">
            <Link to="/notifications" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2 text-center text-sm font-semibold text-forest hover:bg-mint/50">
              See all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
