import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/Feedback';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Field';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import { useChatRoom } from '@/hooks/useChatRoom';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/store/authStore';
import { toast } from '@/store/uiStore';
import { friendlyError } from '@/lib/errors';
import { canSend as canSendApi } from '@/lib/api/conversations';
import { pinMessage, type ChatMessage } from '@/lib/api/chat';

interface Props {
  conversationId: string;
  header: ReactNode;
  showAuthors?: boolean;
  canPin?: boolean;
  className?: string;
  emptyText?: string;
  onPinChanged?: () => void;
}

export function ChatRoom({ conversationId, header, showAuthors, canPin, className, emptyText, onPinChanged }: Props) {
  const meId = useAuth((s) => s.userId) as string;
  const room = useChatRoom(conversationId, meId);
  const permission = useAsync(() => canSendApi(conversationId), [conversationId]);
  const [reply, setReply] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [editText, setEditText] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [unsending, setUnsending] = useState<ChatMessage | null>(null);
  const [unsendBusy, setUnsendBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const initialScrollRef = useRef(true);

  useEffect(() => {
    if (room.loading) return;
    if (initialScrollRef.current || nearBottomRef.current) {
      endRef.current?.scrollIntoView({ block: 'end' });
      initialScrollRef.current = false;
    }
  }, [room.loading, room.messages.length]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const openEdit = (message: ChatMessage) => {
    setEditing(message);
    setEditText(message.body ?? '');
  };

  const saveEdit = async () => {
    if (!editing) return;
    const body = editText.trim();
    if (!body) return;
    setEditBusy(true);
    try {
      await room.edit(editing.id, body);
      toast.success('Message edited.');
      setEditing(null);
    } catch (e) { toast.error(friendlyError(e)); }
    finally { setEditBusy(false); }
  };

  const confirmUnsend = async () => {
    if (!unsending) return;
    setUnsendBusy(true);
    try {
      await room.unsend(unsending.id);
      toast.success('Message unsent.');
      setUnsending(null);
    } catch (e) { toast.error(friendlyError(e)); }
    finally { setUnsendBusy(false); }
  };

  const doPin = async (message: ChatMessage) => {
    try {
      await pinMessage(conversationId, message.id);
      toast.success('Message pinned.');
      onPinChanged?.();
    } catch (e) { toast.error(friendlyError(e)); }
  };

  const replyTo = reply
    ? { name: reply.sender_id === meId ? 'yourself' : reply.sender?.full_name ?? 'Someone', body: reply.body ?? 'Attachment' }
    : null;

  return (
    <Card className={className ?? 'flex h-[calc(100dvh-13rem)] min-h-[480px] flex-col overflow-hidden !p-0'}>
      {header}
      <div ref={listRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto bg-cream/40 p-3 sm:p-4">
        {room.loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-forest" aria-label="Loading messages" /></div>
        ) : room.error ? (
          <ErrorState message={room.error} onRetry={() => void room.reload()} />
        ) : (
          <MessageList
            messages={room.messages}
            meId={meId}
            showAuthors={showAuthors}
            hasMore={room.hasMore}
            loadingOlder={room.loadingOlder}
            onLoadOlder={() => void room.loadOlder()}
            canPin={canPin}
            onPin={(message) => void doPin(message)}
            onBlocked={() => void room.reload()}
            onReply={(message) => setReply(message)}
            onEdit={openEdit}
            onUnsend={(message) => setUnsending(message)}
            onReact={(message, emoji) => { void room.react(message, emoji).catch((e) => toast.error(friendlyError(e))); }}
            emptyText={emptyText}
          />
        )}
        <div ref={endRef} />
      </div>

      <div className="flex min-h-5 items-center justify-between gap-2 px-4 py-1 text-xs text-muted">
        <span>{room.typing.length ? `${room.typing.join(', ')} typing…` : ''}</span>
        <span>{!room.connected ? 'Reconnecting…' : ''}</span>
      </div>

      <MessageComposer
        disabled={permission.data === false}
        replyTo={replyTo}
        onCancelReply={() => setReply(null)}
        onSendText={async (text) => {
          const ok = await room.sendText(text, reply?.id ?? null);
          if (ok) setReply(null);
          return ok;
        }}
        onSendFile={async (file) => { await room.sendFile(file); toast.success('File sent.'); }}
        onSendVoice={async (blob, ms, wave) => { await room.sendVoice(blob, ms, wave); toast.success('Voice note sent.'); }}
        onTyping={room.notifyTyping}
      />

      <Modal
        open={!!editing}
        title="Edit message"
        onClose={() => setEditing(null)}
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button loading={editBusy} onClick={() => void saveEdit()}>Save</Button></>}
      >
        <Textarea label="Message" value={editText} onChange={(e) => setEditText(e.target.value)} maxLength={4000} hint={`${editText.length}/4000`} />
        <p className="mt-2 text-xs text-muted">Edits are allowed for 10 minutes. "(edited)" will show.</p>
      </Modal>

      <ConfirmDialog
        open={!!unsending}
        title="Unsend this message?"
        text="It will be replaced with “This message was unsent” for everyone. This cannot be undone."
        confirmLabel="Unsend"
        danger
        loading={unsendBusy}
        onConfirm={() => void confirmUnsend()}
        onClose={() => setUnsending(null)}
      />
    </Card>
  );
}
