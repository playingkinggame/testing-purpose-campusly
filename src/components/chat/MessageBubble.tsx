import { useEffect, useState } from 'react';
import {
  Ban, Check, CheckCheck, Download, FileText, Flag, MoreHorizontal, Pencil, Pin, Reply, Trash2,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { ReportDialog } from '@/components/safety/ReportDialog';
import { VoicePlayer } from './VoicePlayer';
import { useEditCountdown, formatCountdown } from '@/hooks/useEditCountdown';
import { signedUrl } from '@/lib/api/storage';
import { blockUser } from '@/lib/api/blocks';
import { toast } from '@/store/uiStore';
import { friendlyError } from '@/lib/errors';
import { cn, formatClock, formatDateTime } from '@/lib/utils';
import type { ChatMessage } from '@/lib/api/chat';

function MediaImage({ path, name }: { path: string; name: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    signedUrl('chat-files', path).then((u) => { if (alive) setUrl(u); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [path]);
  if (failed) return <p className="text-xs opacity-70">Photo unavailable.</p>;
  if (!url) return <div className="h-40 w-56 animate-pulse rounded-xl bg-black/10" aria-label="Loading photo" />;
  return <a href={url} target="_blank" rel="noreferrer noopener" className="block"><img src={url} alt={name ?? 'Photo attachment'} loading="lazy" className="max-h-64 w-auto max-w-full rounded-xl object-cover" /></a>;
}

function MediaFile({ path, name, mime }: { path: string; name: string | null; mime: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    signedUrl('chat-files', path, name ?? true).then((u) => { if (alive) setUrl(u); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [path, name]);
  return (
    <div className="flex min-w-[180px] items-center gap-2 rounded-xl bg-black/10 px-2 py-1.5">
      <FileText className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{name ?? 'File'}</span><span className="block text-[10px] opacity-70">{mime ?? 'attachment'}</span></span>
      {failed ? <span className="text-[10px] opacity-70">Unavailable</span> : url ? (
        <a href={url} target="_blank" rel="noreferrer noopener" aria-label={`Download ${name ?? 'file'}`} className="rounded-full p-1 hover:bg-white/20"><Download className="h-4 w-4" aria-hidden="true" /></a>
      ) : <span className="text-[10px] opacity-70">Loading…</span>}
    </div>
  );
}

function Action({ icon: Icon, label, onClick, danger }: { icon: typeof Reply; label: string; onClick: () => void; danger?: boolean }) {
  return <button type="button" onClick={onClick} className={cn('flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium hover:bg-mint/60', danger ? 'text-danger-ink' : 'text-forest')}><Icon className="h-4 w-4" aria-hidden="true" /> {label}</button>;
}

interface Props {
  message: ChatMessage;
  meId: string;
  isMine: boolean;
  showAuthor?: boolean;
  canPin?: boolean;
  onReply: (message: ChatMessage) => void;
  onEdit: (message: ChatMessage) => void;
  onUnsend: (message: ChatMessage) => void;
  onReact: (message: ChatMessage, emoji: string) => void;
  onPin?: (message: ChatMessage) => void;
  onBlocked?: () => void;
}

export function MessageBubble({ message, meId, isMine, showAuthor, canPin, onReply, onEdit, onUnsend, onReact, onPin, onBlocked }: Props) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const left = useEditCountdown(message.created_at);
  const deleted = !!message.deleted_at;
  const canEdit = isMine && message.kind === 'text' && !deleted && left > 0;
  const canUnsend = isMine && !deleted && left > 0;

  const reactions = new Map<string, number>();
  for (const r of message.reactions) reactions.set(r.emoji, (reactions.get(r.emoji) ?? 0) + 1);
  const mineEmoji = new Set(message.reactions.filter((r) => r.user_id === meId).map((r) => r.emoji));
  const others = message.receipts.filter((r) => r.user_id !== meId);
  const seen = others.some((r) => r.seen_at);
  const delivered = others.some((r) => r.delivered_at);

  const closeThen = (fn: () => void) => { setActionsOpen(false); fn(); };
  const confirmBlock = async () => {
    if (!message.sender) return;
    setBlockBusy(true);
    try {
      await blockUser(message.sender.id);
      setBlockOpen(false);
      toast.success('Person blocked.');
      onBlocked?.();
    } catch (e) { toast.error(friendlyError(e)); }
    finally { setBlockBusy(false); }
  };

  return (
    <div className={cn('flex gap-2', isMine ? 'justify-end' : 'justify-start')}>
      {showAuthor && !isMine && <Avatar path={message.sender?.avatar_path} name={message.sender?.full_name} size={28} className="mt-1" />}
      <div className={cn('flex max-w-[86%] flex-col sm:max-w-[76%]', isMine ? 'items-end' : 'items-start')}>
        {showAuthor && !isMine && <p className="mb-0.5 px-1 text-[11px] font-semibold text-muted">{message.sender?.full_name ?? 'Someone'}</p>}
        <div className={cn('rounded-2xl px-3 py-2 text-sm shadow-sm', isMine ? 'rounded-br-md bg-brand text-white' : 'rounded-bl-md border border-line bg-surface text-ink')}>
          {deleted ? (
            <p className={cn('italic', isMine ? 'text-white/75' : 'text-muted')}>This message was unsent</p>
          ) : (
            <>
              {message.reply && (
                <div className={cn('mb-2 rounded-xl border-l-2 px-2 py-1 text-xs', isMine ? 'border-white/40 bg-white/10 text-white/75' : 'border-forest/40 bg-mint/40 text-muted')}>
                  <p className="font-semibold">{message.reply.sender_name}</p>
                  <p className="line-clamp-2">{message.reply.body ?? (message.reply.kind === 'voice' ? 'Voice note' : 'Attachment')}</p>
                </div>
              )}
              {message.kind === 'text' && <p className="whitespace-pre-wrap break-words">{message.body}</p>}
              {message.kind === 'image' && message.media_path && <MediaImage path={message.media_path} name={message.media_name} />}
              {message.kind === 'file' && message.media_path && <MediaFile path={message.media_path} name={message.media_name} mime={message.media_mime} />}
              {message.kind === 'voice' && message.media_path && <VoicePlayer path={message.media_path} durationMs={message.duration_ms} waveform={message.waveform} mine={isMine} />}
            </>
          )}
          <div className={cn('mt-1 flex items-center gap-1.5 text-[10px]', isMine ? 'justify-end text-white/65' : 'text-muted')}>
            <span title={formatDateTime(message.created_at)}>{formatClock(message.created_at)}</span>
            {message.edited_at && !deleted && <span>(edited)</span>}
            {isMine && (
              <span aria-label={seen ? 'Seen' : delivered ? 'Delivered' : 'Sent'}>
                {seen || delivered ? <CheckCheck className={cn('h-3.5 w-3.5', seen && 'text-mint')} aria-hidden="true" /> : <Check className="h-3.5 w-3.5" aria-hidden="true" />}
              </span>
            )}
            {!deleted && (
              <button type="button" onClick={() => setActionsOpen(true)} aria-label="Message actions" className={cn('rounded-full p-0.5 hover:bg-black/10', isMine ? 'text-white/75' : 'text-muted')}><MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" /></button>
            )}
          </div>
        </div>

        {reactions.size > 0 && (
          <div className="mt-1 flex flex-wrap gap-1" aria-label="Reactions">
            {[...reactions.entries()].map(([emoji, count]) => (
              <button key={emoji} type="button" onClick={() => onReact(message, emoji)} aria-label={`${emoji} ${count}${mineEmoji.has(emoji) ? ', including you' : ''}`} className={cn('rounded-full border px-2 py-0.5 text-xs', mineEmoji.has(emoji) ? 'border-forest bg-mint text-forest' : 'border-line bg-surface text-muted hover:bg-mint/40')}>{emoji} {count}</button>
            ))}
          </div>
        )}
        {isMine && !deleted && left > 0 && <p className="mt-0.5 px-1 text-[10px] text-muted">Edit/unsend for {formatCountdown(left)}</p>}
      </div>

      <Modal open={actionsOpen} title="Message actions" onClose={() => setActionsOpen(false)}>
        <div className="space-y-3">
          {!deleted && (
            <div className="flex flex-wrap gap-1.5" aria-label="React to this message">
              {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                <button key={emoji} type="button" onClick={() => closeThen(() => onReact(message, emoji))} className="rounded-xl border border-line bg-surface px-3 py-1.5 text-lg hover:bg-mint/50" aria-label={`React with ${emoji}`}>{emoji}</button>
              ))}
            </div>
          )}
          <div className="grid gap-0.5">
            {!deleted && <Action icon={Reply} label="Reply" onClick={() => closeThen(() => onReply(message))} />}
            {canEdit && <Action icon={Pencil} label="Edit text" onClick={() => closeThen(() => onEdit(message))} />}
            {canPin && !deleted && onPin && <Action icon={Pin} label="Pin message" onClick={() => closeThen(() => onPin(message))} />}
            {!isMine && !deleted && <Action icon={Flag} label="Report message" onClick={() => closeThen(() => setReportOpen(true))} />}
            {!isMine && message.sender && <Action icon={Ban} label="Block sender" danger onClick={() => closeThen(() => setBlockOpen(true))} />}
            {canUnsend && <Action icon={Trash2} label="Unsend" danger onClick={() => closeThen(() => onUnsend(message))} />}
          </div>
        </div>
      </Modal>

      <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} targetType="message" targetId={message.id} targetName={message.sender?.full_name} />
      <ConfirmDialog open={blockOpen} title={`Block ${message.sender?.full_name ?? 'this person'}?`} text="They will disappear from your chats and campus feeds. Any connection between you will be removed." confirmLabel="Block" danger loading={blockBusy} onConfirm={() => void confirmBlock()} onClose={() => setBlockOpen(false)} />
    </div>
  );
}
