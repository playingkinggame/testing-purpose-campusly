import { supabase } from '../supabase';
import { unwrap } from '../errors';
import type { DiscoverPerson, LeaderboardRow, Residence } from '@/types/db';

export interface DiscoverQuery {
  batch?: number | null;
  branch?: string;
  school?: string;
  residence?: Residence | '';
  interest?: string;
  query?: string;
  includeConnected?: boolean;
  limit?: number;
  offset?: number;
}

export async function discoverPeople(filters: DiscoverQuery = {}): Promise<DiscoverPerson[]> {
  const res = await supabase.rpc('discover_people', {
    p_batch: filters.batch ?? null,
    p_branch: filters.branch?.trim() || null,
    p_school: filters.school?.trim() || null,
    p_residence: filters.residence || null,
    p_interest: filters.interest?.trim() || null,
    p_query: filters.query?.trim() || null,
    p_include_connected: filters.includeConnected ?? false,
    p_limit: filters.limit ?? 30,
    p_offset: filters.offset ?? 0,
  });
  return unwrap<DiscoverPerson[]>(res) ?? [];
}

export async function getWeeklyLeaderboard(limit = 20): Promise<LeaderboardRow[]> {
  const res = await supabase
    .from('weekly_leaderboard')
    .select('id, username, full_name, avatar_path, branch, batch, hearts_this_week')
    .limit(limit);
  return unwrap<LeaderboardRow[]>(res) ?? [];
}
