import { supabase } from '../supabase';
import { unwrap } from '../errors';
import { requireUserId } from './auth';
import { currentWeekStartIST } from '../utils';

/** Inserts only to_user; the database stamps from_user and the current week. */
export async function giveHeart(toUserId: string): Promise<void> {
  const res = await supabase.from('hearts').insert({ to_user: toUserId });
  unwrap(res as { data: unknown; error: unknown });
}

export async function hasHeartedThisWeek(toUserId: string): Promise<boolean> {
  const me = await requireUserId();
  const res = await supabase
    .from('hearts')
    .select('week_start')
    .eq('from_user', me)
    .eq('to_user', toUserId)
    .eq('week_start', currentWeekStartIST())
    .limit(1);
  const rows = unwrap<Array<{ week_start: string }>>(res) ?? [];
  return rows.length > 0;
}
