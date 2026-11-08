import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { CountBadge } from '@/components/ui/Badge';
import { AsyncView, EmptyState } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/store/authStore';
import { usePresence } from '@/store/presenceStore';
import { listMine } from '@/lib/api/conversations';
import { getMiniProfiles } from '@/lib/api/profiles';
import { subscribeChatList } from '@/lib/api/realtime';
import { cn, timeAgo } from '@/lib/utils';
import type { ConversationSummary, MiniProfile } from '@/types/db';

interface Item { conv: ConversationSummary; person: MiniProfile | null }

function preview(conv: ConversationSummary, me: string): string {
  if (!conv.last_message_id) return 'No messages yet';
  if (conv.last_message_unsent) return 'This message was unsent';
  if (conv.last_message_kind === 'image') return '📷 Photo';
  if (conv.last_message_kind === 'file') return '📎 File';
  if (conv.last_message_kind === 'voice') return '🎤 Voice note';
  const body = conv.last_message_body ?? 'Message';
  return conv.last_message_sender === me ? `You: ${body}` : body;
}

export default function ChatListPage() {
  const me = useAuth((s) => s.userId) as string;
  const online = usePresence((s) => s.online);
  const state = useAsync(async () => {
    const rows = await listMine();
    const people = await getMiniProfiles(rows.map((r) => r.other_user_id ?? ''));
    return rows.map((conv) => ({ conv, person: conv.other_user_id ? people.get(conv.other_user_id) ?? null : null }));
  }, []);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeChatList(me, () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void state.reload(), 500);
    });
    return () => {
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [me, state.reload]);

  const items = state.data ?? [];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-forest sm:text-3xl"><MessageCircle className="h-7 w-7" aria-hidden="true" /> Chats</h1>
          <p className="text-sm text-muted">Private conversations with your connections.</p>
        </div>
        <Link to="/discover"><Button variant="secondary" size="sm">Find people</Button></Link>
      </header>

      <Card className="!p-2">
        <AsyncView
          loading={state.loading}
          error={state.error}
          onRetry={() => void state.reload()}
          hasData={!!state.data}
          isEmpty={!state.loading && !state.error && items.length === 0}
          empty={<EmptyState icon={<MessageCircle className="h-6 w-6" />} title="No chats yet" text="Connect with someone, then open their profile and tap Message." action={<Link to="/discover"><Button size="sm">Discover people</Button></Link>} />}
        >
          <ul className="divide-y divide-line/70">
            {items.map(({ conv, person }) => {
              const isGroup = conv.type === 'group';
              const name = isGroup ? conv.group_name ?? 'Group' : person?.full_name ?? 'Chat';
              const username = person?.username;
              const href = isGroup ? `/groups/${conv.conversation_id}` : `/chat/${conv.conversation_id}`;
              const isOnline = !isGroup && conv.other_user_id ? online.includes(conv.other_user_id) : false;
              return (
                <li key={conv.conversation_id}>
                  <Link to={href} className="flex items-center gap-3 rounded-2xl p-3 hover:bg-mint/40">
                    <span className="relative shrink-0">
                      <Avatar path={isGroup ? conv.group_avatar : person?.avatar_path} name={name} size={48} />
                      {isOnline && <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-cream bg-green-500" aria-label="Online" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-forest">{name}</span>
                        {isGroup && <span className="rounded-full bg-mint px-1.5 text-[10px] font-semibold text-forest">Group</span>}
                      </span>
                      <span className={cn('block truncate text-sm', conv.unread_count > 0 ? 'font-semibold text-ink' : 'text-muted')}>{preview(conv, me)}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[11px] text-muted">{timeAgo(conv.last_message_at)}</span>
                      {conv.unread_count > 0 && <CountBadge n={conv.unread_count} />}
                    </span>
                  </Link>
                  {!isGroup && username && <span className="sr-only">Open chat with {name}</span>}
                </li>
              );
            })}
          </ul>
        </AsyncView>
      </Card>
    </div>
  );
}
