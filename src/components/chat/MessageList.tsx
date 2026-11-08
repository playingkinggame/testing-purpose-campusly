import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { MessageBubble } from './MessageBubble';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/lib/api/chat';

function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

interface Props {
  messages: ChatMessage[];
  meId: string;
  showAuthors?: boolean;
  hasMore: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  onReply: (message: ChatMessage) => void;
  onEdit: (message: ChatMessage) => void;
  onUnsend: (message: ChatMessage) => void;
  onReact: (message: ChatMessage, emoji: string) => void;
  onPin?: (message: ChatMessage) => void;
  canPin?: boolean;
  onBlocked?: () => void;
  emptyText?: string;
}

export function MessageList(props: Props) {
  const { messages, meId, showAuthors, hasMore, loadingOlder, onLoadOlder } = props;

  if (!messages.length) {
    return <EmptyState title="No messages yet" text={props.emptyText ?? 'Say hi and start the conversation.'} icon={<span className="text-2xl">💬</span>} />;
  }

  return (
    <div className="space-y-2">
      {hasMore && (
        <div className="flex justify-center pb-1">
          <Button variant="ghost" size="sm" loading={loadingOlder} onClick={onLoadOlder}>Load older messages</Button>
        </div>
      )}
      {messages.map((message, index) => {
        const showDay = index === 0 || dayKey(message.created_at) !== dayKey(messages[index - 1].created_at);
        return (
          <div key={message.id}>
            {showDay && (
              <div className="my-3 flex items-center gap-2" aria-hidden="true">
                <span className="h-px flex-1 bg-line/70" />
                <span className="rounded-full bg-mint/60 px-2.5 py-0.5 text-[11px] font-semibold text-forest">{dayLabel(message.created_at)}</span>
                <span className="h-px flex-1 bg-line/70" />
              </div>
            )}
            <div className={cn(index > 0 && !showDay && 'mt-0.5')}>
              <MessageBubble
                message={message}
                meId={meId}
                isMine={message.sender_id === meId}
                showAuthor={showAuthors}
                canPin={props.canPin}
                onReply={props.onReply}
                onEdit={props.onEdit}
                onUnsend={props.onUnsend}
                onReact={props.onReact}
                onPin={props.onPin}
                onBlocked={props.onBlocked}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
