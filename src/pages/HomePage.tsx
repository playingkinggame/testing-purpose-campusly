import { Link } from 'react-router-dom';
import { Bell, Flame, Heart, MessageCircle, UserPlus } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { AsyncView, EmptyState } from '@/components/ui/Feedback';
import { CAMPUS_ITEMS } from '@/components/layout/navItems';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/store/authStore';
import { useUnread } from '@/store/unreadStore';
import { toast } from '@/store/uiStore';
import { friendlyError } from '@/lib/errors';
import { listNotifications, markAllNotificationsRead, type NotificationWithActor } from '@/lib/api/notifications';
import { cn, firstName as getFirstName, timeAgo } from '@/lib/utils';
import type { NotificationKind } from '@/types/db';

const TEXT: Record<NotificationKind, { text: string; to: string }> = {
  connection_request: { text: 'sent you a connection request', to: '/requests' },
  connection_accepted: { text: 'accepted your request. You can chat now!', to: '/chat' },
  teammate_invite: { text: 'invited you to join their team', to: '/teammates' },
  senior_question: { text: 'asked you a question', to: '/seniors' },
  senior_answer: { text: 'answered your question', to: '/seniors' },
};

function Stat({ icon: Icon, label, value, to }: { icon: typeof Flame; label: string; value: number; to?: string }) {
  const inner = (
    <Card className="flex items-center gap-3 !p-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-mint text-forest" aria-hidden="true"><Icon className="h-5 w-5" /></span>
      <span>
        <span className="block text-2xl font-bold leading-none text-forest">{value}</span>
        <span className="text-xs text-muted">{label}</span>
      </span>
    </Card>
  );
  return to ? <Link to={to} className="block rounded-[16px] transition-transform duration-200 ease-out hover:-translate-y-0.5 motion-reduce:transform-none">{inner}</Link> : inner;
}

export default function HomePage() {
  const profile = useAuth((s) => s.profile);
  const unread = useUnread();
  const notes = useAsync(listNotifications, []);

  const markRead = async () => {
    try {
      await markAllNotificationsRead();
      useUnread.getState().set({ notifications: 0 });
      await notes.reload();
    } catch (e) { toast.error(friendlyError(e)); }
  };

  const items = (notes.data ?? []) as NotificationWithActor[];
  const firstName = getFirstName(profile?.full_name) || 'there';

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-forest">Hi {firstName} 👋</h1>
        <p className="text-muted">Here is what is happening around you.</p>
      </header>

      <section aria-label="Your numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Flame} label="Day streak" value={profile?.streak_count ?? 0} />
        <Stat icon={Heart} label="Hearts received" value={profile?.hearts_total ?? 0} to="/profile" />
        <Stat icon={UserPlus} label="Requests waiting" value={unread.requests} to="/requests" />
        <Stat icon={MessageCircle} label="Unread messages" value={unread.chat} to="/chat" />
      </section>

      <section aria-labelledby="activity-h">
        <div className="mb-2 flex items-center justify-between">
          <h2 id="activity-h" className="flex items-center gap-2 text-lg font-semibold text-forest"><Bell className="h-5 w-5" aria-hidden="true" /> Recent activity</h2>
          <div className="flex items-center gap-1">
            {items.some((n) => !n.read_at) && <Button variant="ghost" size="sm" onClick={() => void markRead()}>Mark all as read</Button>}
            <Link to="/notifications" className="text-sm font-semibold text-forest hover:underline">See all</Link>
          </div>
        </div>
        <Card className="!p-2">
          <AsyncView loading={notes.loading} error={notes.error} onRetry={() => void notes.reload()} hasData={!!notes.data}
            isEmpty={items.length === 0}
            empty={<EmptyState title="All quiet for now" text="When someone connects with you or invites you, it shows up here." action={<Link to="/discover"><Button size="sm">Find people</Button></Link>} />}>
            <ul className="divide-y divide-line/70">
              {items.map((n) => {
                const meta = TEXT[n.kind];
                return (
                  <li key={n.id}>
                    <Link to={meta.to} className={cn('flex items-center gap-3 rounded-2xl p-3 hover:bg-mint/40', !n.read_at && 'bg-mint/30')}>
                      <Avatar path={n.actor?.avatar_path} name={n.actor?.full_name} size={40} />
                      <span className="min-w-0 flex-1 text-sm">
                        <strong className="text-forest">{n.actor?.full_name ?? 'Someone'}</strong> {meta.text}
                        <span className="block text-xs text-muted">{timeAgo(n.created_at)}</span>
                      </span>
                      {!n.read_at && <span className="h-2.5 w-2.5 rounded-full bg-brand" aria-label="New" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </AsyncView>
        </Card>
      </section>

      <section aria-labelledby="campus-h">
        <h2 id="campus-h" className="mb-2 text-lg font-semibold text-forest">Around campus</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {CAMPUS_ITEMS.map((i) => {
            const Icon = i.icon;
            return (
              <Link key={i.to} to={i.to} className="glass flex flex-col gap-2 p-4 transition-transform duration-200 ease-out hover:-translate-y-0.5 motion-reduce:transform-none">
                <Icon className="h-6 w-6 text-forest" aria-hidden="true" />
                <span className="text-sm font-semibold text-forest">{i.label}</span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
