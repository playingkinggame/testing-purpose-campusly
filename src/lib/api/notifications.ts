import { supabase } from '../supabase';
import { unwrap } from '../errors';
import { getMiniProfiles } from './profiles';
import type { AppNotification, MiniProfile } from '@/types/db';

export interface NotificationWithActor extends AppNotification { actor: MiniProfile | null }

export async function listNotifications(limit = 30): Promise<NotificationWithActor[]> {
  const res = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(limit);
  const rows = unwrap<AppNotification[]>(res) ?? [];
  const actors = await getMiniProfiles(rows.map((r) => r.actor_id ?? ''));
  return rows.map((r) => ({ ...r, actor: r.actor_id ? actors.get(r.actor_id) ?? null : null }));
}

export async function countUnreadNotifications(): Promise<number> {
  const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  return error ? 0 : count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  const res = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null);
  unwrap(res as { data: unknown; error: unknown });
}

export async function markAllNotificationsRead(): Promise<void> {
  const res = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
  unwrap(res as { data: unknown; error: unknown });
}
