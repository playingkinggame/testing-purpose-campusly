import { supabase } from '../supabase';
import { unwrap } from '../errors';
import type { ConversationSummary } from '@/types/db';

export async function listMine(): Promise<ConversationSummary[]> {
  const res = await supabase.rpc('list_my_conversations');
  return unwrap<ConversationSummary[]>(res) ?? [];
}

export function totalUnread(rows: ConversationSummary[]): number {
  return rows.reduce((n, r) => n + (r.muted ? 0 : r.unread_count), 0);
}

/** Opens (or creates) the 1-to-1 chat. Works only for accepted connections. */
export async function startDm(otherUserId: string): Promise<string> {
  const res = await supabase.rpc('start_dm', { p_other: otherUserId });
  return unwrap<string>(res);
}

export async function markSeen(conversationId: string): Promise<void> {
  await supabase.rpc('mark_conversation_seen', { p_conversation: conversationId });
}

export async function markAllDelivered(): Promise<void> {
  await supabase.rpc('mark_all_delivered');
}

export async function canSend(conversationId: string): Promise<boolean> {
  const res = await supabase.rpc('can_send', { cid: conversationId });
  return res.error ? false : res.data === true;
}
