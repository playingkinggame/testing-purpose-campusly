import { supabase } from '../supabase';
import { unwrap } from '../errors';
import type { BlockedUser } from '@/types/db';

export async function blockUser(userId: string): Promise<void> {
  const res = await supabase.from('blocks').insert({ blocked_id: userId });
  unwrap(res as { data: unknown; error: unknown });
}

export async function unblockUser(userId: string): Promise<void> {
  const res = await supabase.from('blocks').delete().eq('blocked_id', userId);
  unwrap(res as { data: unknown; error: unknown });
}

/** Uses the phase-2 RPC because profiles_public hides blocked people. */
export async function listBlocked(): Promise<BlockedUser[]> {
  const res = await supabase.rpc('list_blocked_users');
  return unwrap<BlockedUser[]>(res) ?? [];
}

export async function isBlockedByMe(userId: string): Promise<boolean> {
  const res = await supabase.from('blocks').select('blocked_id').eq('blocked_id', userId).limit(1);
  const rows = unwrap<Array<{ blocked_id: string }>>(res) ?? [];
  return rows.length > 0;
}
