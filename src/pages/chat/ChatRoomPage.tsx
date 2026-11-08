import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { AsyncView, EmptyState } from '@/components/ui/Feedback';
import { ChatRoom } from '@/components/chat/ChatRoom';
import { useAsync } from '@/hooks/useAsync';
import { usePresence } from '@/store/presenceStore';
import { listMine } from '@/lib/api/conversations';
import { getPublicProfile } from '@/lib/api/profiles';
import { AppError } from '@/lib/errors';
import { formatLastSeen, firstName } from '@/lib/utils';
import type { ConversationSummary, PublicProfile } from '@/types/db';

export default function ChatRoomPage() {
  const { id = '' } = useParams();
  const online = usePresence((s) => s.online);
  const state = useAsync(async () => {
    const rows = await listMine();
    const conv = rows.find((c) => c.conversation_id === id);
    if (!conv) throw new AppError('This chat is unavailable.');
    const person = conv.type === 'dm' && conv.other_user_id ? await getPublicProfile(conv.other_user_id) : null;
    return { conv, person };
  }, [id]);

  if (state.data?.conv.type === 'group') return <Navigate to={`/groups/${id}`} replace />;

  const conv = state.data?.conv;
  const person = state.data?.person;

  return (
    <AsyncView
      loading={state.loading}
      error={state.error}
      onRetry={() => void state.reload()}
      hasData={!!state.data}
      isEmpty={!state.loading && !state.error && !conv}
      empty={<EmptyState title="Chat not found" text="It may have been removed, or you may no longer be connected." action={<Link to="/chat">Back to chats</Link>} />}
    >
      {conv && (
        <ChatRoom
          conversationId={id}
          emptyText={person ? `Say hi to ${firstName(person.full_name) || person.full_name}.` : 'Say hi.'}
          canPin
          header={<ChatHeader person={person ?? null} online={!!conv.other_user_id && online.includes(conv.other_user_id)} />}
        />
      )}
    </AsyncView>
  );
}

function ChatHeader({ person, online }: { person: PublicProfile | null; online: boolean }) {
  const name = person?.full_name ?? 'Chat';
  const status = online ? 'Online' : person?.last_seen_at ? formatLastSeen(person.last_seen_at) : person ? `@${person.username}` : '';
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-line p-2 sm:p-3">
      <Link to="/chat" aria-label="Back to chats" className="rounded-2xl p-2 text-forest hover:bg-mint/60"><ArrowLeft className="h-5 w-5" aria-hidden="true" /></Link>
      <Link to={person ? `/u/${person.username}` : '/chat'} className="flex min-w-0 flex-1 items-center gap-2">
        <span className="relative shrink-0">
          <Avatar path={person?.avatar_path} name={name} size={40} />
          {online && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-cream bg-green-500" aria-label="Online" />}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-forest">{name}</span>
          <span className="block truncate text-xs text-muted">{status}</span>
        </span>
      </Link>
    </div>
  );
}
