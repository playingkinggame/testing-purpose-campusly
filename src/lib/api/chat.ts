import { supabase } from '../supabase';
import { AppError, unwrap } from '../errors';
import { requireUserId } from './auth';
import { getMiniProfiles } from './profiles';
import { compressImage, uploadFile, validateFile } from './storage';
import { safeFileName } from '../utils';
import type { Message, MessageKind, MessageReaction, MessageReceipt, MiniProfile, PinnedMessage } from '@/types/db';

export interface ReplyPreview {
  id: string;
  body: string | null;
  kind: MessageKind;
  sender_name: string;
}

export interface ChatMessage extends Message {
  sender: MiniProfile | null;
  reply: ReplyPreview | null;
  reactions: MessageReaction[];
  receipts: MessageReceipt[];
}

export interface MessagePage {
  messages: ChatMessage[];
  hasMore: boolean;
}

export interface NewMessageInput {
  kind: MessageKind;
  body?: string | null;
  media_path?: string | null;
  media_name?: string | null;
  media_mime?: string | null;
  media_size?: number | null;
  duration_ms?: number | null;
  waveform?: number[] | null;
  reply_to?: string | null;
}

type ReplyRow = Pick<Message, 'id' | 'body' | 'kind' | 'sender_id'>;

function sortByCreated(a: ChatMessage, b: ChatMessage): number {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

/** One page of messages, oldest first. Pass `before` (the oldest loaded created_at) to load older. */
export async function listMessages(conversationId: string, before?: string | null, limit = 40): Promise<MessagePage> {
  let query = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (before) query = query.lt('created_at', before);
  const rows = unwrap<Message[]>(await query) ?? [];
  if (!rows.length) return { messages: [], hasMore: false };

  const ordered = [...rows].reverse();
  const messageIds = ordered.map((m) => m.id);
  const replyIds = [...new Set(ordered.map((m) => m.reply_to).filter((v): v is string => Boolean(v)))];

  const [reactionsRes, receiptsRes, replyRows] = await Promise.all([
    supabase.from('message_reactions').select('*').in('message_id', messageIds),
    supabase.from('message_receipts').select('*').in('message_id', messageIds),
    replyIds.length
      ? supabase.from('messages').select('id, body, kind, sender_id').in('id', replyIds)
      : Promise.resolve({ data: [] as ReplyRow[], error: null }),
  ]);

  const reactions = unwrap<MessageReaction[]>(reactionsRes) ?? [];
  const receipts = unwrap<MessageReceipt[]>(receiptsRes) ?? [];
  const replies = (replyRows.data ?? []) as ReplyRow[];
  const people = await getMiniProfiles([
    ...ordered.map((m) => m.sender_id),
    ...replies.map((r) => r.sender_id),
  ]);

  const reactionsBy = new Map<string, MessageReaction[]>();
  for (const r of reactions) {
    const list = reactionsBy.get(r.message_id) ?? [];
    list.push(r);
    reactionsBy.set(r.message_id, list);
  }
  const receiptsBy = new Map<string, MessageReceipt[]>();
  for (const r of receipts) {
    const list = receiptsBy.get(r.message_id) ?? [];
    list.push(r);
    receiptsBy.set(r.message_id, list);
  }
  const repliesBy = new Map(replies.map((r) => [r.id, r]));

  const messages: ChatMessage[] = ordered.map((m) => {
    const replyRow = m.reply_to ? repliesBy.get(m.reply_to) : undefined;
    return {
      ...m,
      sender: people.get(m.sender_id) ?? null,
      reply: replyRow
        ? {
            id: replyRow.id,
            body: replyRow.body,
            kind: replyRow.kind,
            sender_name: people.get(replyRow.sender_id)?.full_name ?? 'Someone',
          }
        : null,
      reactions: (reactionsBy.get(m.id) ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at)),
      receipts: receiptsBy.get(m.id) ?? [],
    };
  });

  return { messages, hasMore: rows.length === limit };
}

export async function sendMessage(conversationId: string, input: NewMessageInput): Promise<Message> {
  const payload: Record<string, unknown> = {
    conversation_id: conversationId,
    kind: input.kind,
  };
  if (input.body !== undefined) payload.body = input.body;
  if (input.media_path !== undefined) payload.media_path = input.media_path;
  if (input.media_name !== undefined) payload.media_name = input.media_name;
  if (input.media_mime !== undefined) payload.media_mime = input.media_mime;
  if (input.media_size !== undefined) payload.media_size = input.media_size;
  if (input.duration_ms !== undefined) payload.duration_ms = input.duration_ms;
  if (input.waveform !== undefined) payload.waveform = input.waveform;
  if (input.reply_to) payload.reply_to = input.reply_to;
  const res = await supabase.from('messages').insert(payload).select('*').single();
  return unwrap<Message>(res);
}

export async function editMessage(id: string, body: string): Promise<Message> {
  const res = await supabase.from('messages').update({ body }).eq('id', id).select('*').single();
  return unwrap<Message>(res);
}

export async function unsendMessage(id: string): Promise<void> {
  const res = await supabase.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  unwrap(res as { data: unknown; error: unknown });
}

export async function toggleReaction(messageId: string, emoji: string, active: boolean): Promise<void> {
  if (active) {
    const res = await supabase.from('message_reactions').insert({ message_id: messageId, emoji });
    unwrap(res as { data: unknown; error: unknown });
  } else {
    const res = await supabase.from('message_reactions').delete().eq('message_id', messageId).eq('emoji', emoji);
    unwrap(res as { data: unknown; error: unknown });
  }
}

export interface UploadedChatFile {
  kind: 'image' | 'file';
  path: string;
  name: string;
  mime: string;
  size: number;
}

export async function uploadChatFile(conversationId: string, file: File): Promise<UploadedChatFile> {
  const problem = validateFile('chat-files', file);
  if (problem) throw new AppError(problem);
  const me = await requireUserId();
  const isImage = file.type.startsWith('image/');
  const body: Blob = isImage && file.type !== 'image/gif' ? await compressImage(file, 1280, 0.85) : file;
  const mime = (body.type || file.type || 'application/octet-stream').split(';')[0];
  const name = isImage && file.type !== 'image/gif' ? file.name.replace(/\.[^.]+$/, '.jpg') : file.name;
  const path = `${conversationId}/${me}/${safeFileName(name)}`;
  await uploadFile('chat-files', path, body, mime);
  return {
    kind: isImage ? 'image' : 'file',
    path,
    name: file.name,
    mime,
    size: body.size,
  };
}

export interface UploadedVoice {
  path: string;
  mime: string;
  size: number;
}

export async function uploadVoiceNote(conversationId: string, blob: Blob, durationMs: number, waveform: number[] | null): Promise<UploadedVoice> {
  const mime = (blob.type || 'audio/webm').split(';')[0];
  const problem = validateFile('voice-notes', { size: blob.size, type: mime });
  if (problem) throw new AppError(problem);
  const me = await requireUserId();
  const path = `${conversationId}/${me}/voice-${Date.now()}.webm`;
  await uploadFile('voice-notes', path, blob, mime);
  void durationMs;
  void waveform;
  return { path, mime, size: blob.size };
}

export function mediaBucket(message: Pick<ChatMessage, 'kind'>): 'chat-files' | 'voice-notes' {
  return message.kind === 'voice' ? 'voice-notes' : 'chat-files';
}

export interface PinnedItem {
  pin: PinnedMessage;
  message: Message | null;
  sender: MiniProfile | null;
}

export async function listPinned(conversationId: string): Promise<PinnedItem[]> {
  const res = await supabase
    .from('pinned_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('pinned_at', { ascending: false });
  const pins = unwrap<PinnedMessage[]>(res) ?? [];
  if (!pins.length) return [];
  const ids = pins.map((p) => p.message_id);
  const messagesRes = await supabase.from('messages').select('*').in('id', ids);
  const messages = unwrap<Message[]>(messagesRes) ?? [];
  const people = await getMiniProfiles(messages.map((m) => m.sender_id));
  const byId = new Map(messages.map((m) => [m.id, m]));
  return pins.map((pin) => {
    const message = byId.get(pin.message_id) ?? null;
    return { pin, message, sender: message ? people.get(message.sender_id) ?? null : null };
  });
}

export async function pinMessage(conversationId: string, messageId: string): Promise<void> {
  const res = await supabase.from('pinned_messages').insert({ conversation_id: conversationId, message_id: messageId });
  unwrap(res as { data: unknown; error: unknown });
}

export async function unpinMessage(pinId: string): Promise<void> {
  const res = await supabase.from('pinned_messages').delete().eq('id', pinId);
  unwrap(res as { data: unknown; error: unknown });
}

export { sortByCreated };
