import { supabase } from '../supabase';
import { unwrap } from '../errors';
import type { Badge, UserBadge } from '@/types/db';

/** Badges are awarded by admins from the SQL editor only; the app just reads them. */
export async function listUserBadges(userId: string): Promise<UserBadge[]> {
  const links = await supabase
    .from('user_badges')
    .select('badge_id, awarded_at')
    .eq('user_id', userId)
    .order('awarded_at', { ascending: false });
  const rows = unwrap<Array<{ badge_id: string; awarded_at: string }>>(links) ?? [];
  if (!rows.length) return [];

  const badgeRes = await supabase
    .from('badges')
    .select('id, slug, name, description, icon')
    .in('id', rows.map((row) => row.badge_id));
  const badges = unwrap<Badge[]>(badgeRes) ?? [];
  const byId = new Map(badges.map((badge) => [badge.id, badge]));

  const out: UserBadge[] = [];
  for (const row of rows) {
    const badge = byId.get(row.badge_id);
    if (badge) out.push({ awarded_at: row.awarded_at, badges: badge });
  }
  return out;
}
